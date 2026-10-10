import fs from "node:fs";

export const ASSIGNMENT_SCHEMA_VERSION = "2.0";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTextSlot(name, input) {
  const text = input?.text ?? input?.content ?? "";
  return {
    name,
    kind: "text",
    text: typeof text === "string" ? text : String(text),
    style: typeof input?.style === "string" ? input.style : undefined,
    required: Boolean(input?.required),
  };
}

function normalizeImageSlot(name, input) {
  const rawSrc = input?.src ?? input?.image_path;
  return {
    name,
    kind: "image",
    src: typeof rawSrc === "string" ? rawSrc : "",
    caption: typeof input?.caption === "string" ? input.caption : undefined,
    fit: typeof input?.fit === "string" ? input.fit : undefined,
    required: Boolean(input?.required),
  };
}

function convertLegacyAssignmentEntry(name, entry) {
  if (!isObject(entry)) {
    return normalizeTextSlot(name, { content: entry ?? "" });
  }

  if (typeof entry.src === "string" || typeof entry.image_path === "string") {
    return normalizeImageSlot(name, entry);
  }

  return normalizeTextSlot(name, entry);
}

function inferArtifactType(input) {
  const templateName = input?.metadata?.templateName || input?.metadata?.documentName || "";
  if (/card/i.test(templateName)) return "cards";
  return "newspaper";
}

export function adaptLegacyAssignments(legacyInput, overrides = {}) {
  if (!isObject(legacyInput) || !Array.isArray(legacyInput.pages)) {
    throw new Error("Legacy assignment input must contain pages[].");
  }

  const templateId =
    overrides.templateId ||
    legacyInput?.metadata?.templateName ||
    legacyInput?.metadata?.documentName ||
    "legacy_template";

  const artifactType = overrides.artifactType || inferArtifactType(legacyInput);

  const pages = legacyInput.pages.map((legacyPage, pageIndex) => {
    const assignments = isObject(legacyPage.assignments) ? legacyPage.assignments : {};
    const slots = Object.keys(assignments).map((slotName) =>
      convertLegacyAssignmentEntry(slotName, assignments[slotName])
    );

    const pageId =
      (typeof legacyPage.id === "string" && legacyPage.id) ||
      (typeof legacyPage.name === "string" && legacyPage.name) ||
      `p${pageIndex + 1}`;

    return {
      id: pageId,
      slots,
    };
  });

  return {
    schema_version: ASSIGNMENT_SCHEMA_VERSION,
    artifact_type: artifactType,
    template_id: templateId,
    output_mode: overrides.outputMode || "deck",
    metadata: {
      adapted_from_legacy: true,
      source_generated_at: legacyInput?.metadata?.generatedAt,
      ...legacyInput?.metadata,
      ...overrides.metadata,
    },
    pages,
  };
}

export function validateAssignmentDocument(input) {
  const errors = [];

  if (!isObject(input)) {
    return { valid: false, errors: ["Assignment document must be an object."] };
  }

  if (input.schema_version !== ASSIGNMENT_SCHEMA_VERSION) {
    errors.push(`schema_version must be \"${ASSIGNMENT_SCHEMA_VERSION}\".`);
  }

  if (typeof input.artifact_type !== "string" || !input.artifact_type) {
    errors.push("artifact_type must be a non-empty string.");
  }

  if (typeof input.template_id !== "string" || !input.template_id) {
    errors.push("template_id must be a non-empty string.");
  }

  if (!Array.isArray(input.pages) || input.pages.length === 0) {
    errors.push("pages must be a non-empty array.");
  }

  if (Array.isArray(input.pages)) {
    input.pages.forEach((page, pageIndex) => {
      if (!isObject(page)) {
        errors.push(`pages[${pageIndex}] must be an object.`);
        return;
      }

      if (typeof page.id !== "string" || !page.id) {
        errors.push(`pages[${pageIndex}].id must be a non-empty string.`);
      }

      if (!Array.isArray(page.slots)) {
        errors.push(`pages[${pageIndex}].slots must be an array.`);
        return;
      }

      const slotNames = new Set();
      page.slots.forEach((slot, slotIndex) => {
        if (!isObject(slot)) {
          errors.push(`pages[${pageIndex}].slots[${slotIndex}] must be an object.`);
          return;
        }

        if (typeof slot.name !== "string" || !slot.name) {
          errors.push(`pages[${pageIndex}].slots[${slotIndex}].name must be a non-empty string.`);
        } else if (slotNames.has(slot.name)) {
          errors.push(`Duplicate slot name on page ${page.id}: ${slot.name}`);
        } else {
          slotNames.add(slot.name);
        }

        if (slot.kind !== "text" && slot.kind !== "image") {
          errors.push(`pages[${pageIndex}].slots[${slotIndex}].kind must be \"text\" or \"image\".`);
        }

        if (slot.kind === "text" && typeof slot.text !== "string") {
          errors.push(`pages[${pageIndex}].slots[${slotIndex}] text slot requires text:string.`);
        }

        if (slot.kind === "image" && typeof slot.src !== "string") {
          errors.push(`pages[].slots[] image slot requires src:string.`);
        }

        if (slot.kind === "image" && slot.required && !slot.src) {
          errors.push(`pages[].slots[] required image slot is missing src.`);
        }
      });
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function normalizeAssignmentDocument(input, options = {}) {
  const allowLegacy = options.allowLegacy !== false;
  const overrides = options.overrides || {};

  if (input?.schema_version === ASSIGNMENT_SCHEMA_VERSION) {
    const result = validateAssignmentDocument(input);
    if (!result.valid) {
      throw new Error(`Invalid assignment document:\n- ${result.errors.join("\n- ")}`);
    }
    return {
      document: input,
      warnings: [],
    };
  }

  if (allowLegacy && Array.isArray(input?.pages) && input?.pages.some((page) => isObject(page?.assignments))) {
    const adapted = adaptLegacyAssignments(input, {
      templateId: overrides.templateId,
      artifactType: overrides.artifactType,
      outputMode: overrides.outputMode,
      metadata: overrides.metadata,
    });
    const result = validateAssignmentDocument(adapted);
    if (!result.valid) {
      throw new Error(`Legacy assignment adaptation failed validation:\n- ${result.errors.join("\n- ")}`);
    }
    return {
      document: adapted,
      warnings: ["Input used legacy assignment format and was adapted to schema v2.0."],
    };
  }

  throw new Error("Unrecognized assignment format. Expected schema v2.0 or legacy pages[].assignments format.");
}

export function readAssignmentDocument(filePath, options = {}) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return normalizeAssignmentDocument(raw, options);
}
