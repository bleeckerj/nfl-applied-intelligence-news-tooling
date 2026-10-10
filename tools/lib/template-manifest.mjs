import fs from "node:fs";

export const TEMPLATE_MANIFEST_SCHEMA_VERSION = "1.0";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function validateSlotDefinition(slot, path, errors, { requirePattern = false } = {}) {
  if (!isObject(slot)) {
    errors.push(`${path} must be an object.`);
    return;
  }

  if (requirePattern) {
    if (typeof slot.name_pattern !== "string" || !slot.name_pattern.includes("{index}")) {
      errors.push(`${path}.name_pattern must include {index}.`);
    }
  } else if (typeof slot.name !== "string" || !slot.name) {
    errors.push(`${path}.name must be a non-empty string.`);
  }

  if (slot.kind !== "text" && slot.kind !== "image") {
    errors.push(`${path}.kind must be \"text\" or \"image\".`);
  }

  // source is optional; omitted source uses passthrough lookup by slot name.
  if (
    slot.source !== undefined &&
    typeof slot.source !== "string" &&
    !Array.isArray(slot.source)
  ) {
    errors.push(`${path}.source must be a string or string array when provided.`);
  }

  if (slot.format !== undefined) {
    if (!isObject(slot.format)) {
      errors.push(`${path}.format must be an object when provided.`);
    } else {
      const arrayMode = slot.format.array;
      if (
        arrayMode !== undefined &&
        arrayMode !== "join" &&
        arrayMode !== "newline" &&
        arrayMode !== "bullet" &&
        arrayMode !== "json"
      ) {
        errors.push(`${path}.format.array must be one of: join, newline, bullet, json.`);
      }

      if (slot.format.separator !== undefined && typeof slot.format.separator !== "string") {
        errors.push(`${path}.format.separator must be a string.`);
      }

      if (
        slot.format.limit !== undefined &&
        (!Number.isInteger(slot.format.limit) || slot.format.limit <= 0)
      ) {
        errors.push(`${path}.format.limit must be a positive integer.`);
      }
    }
  }
}

export function validateTemplateManifest(input) {
  const errors = [];

  if (!isObject(input)) {
    return { valid: false, errors: ["Template manifest must be an object."] };
  }

  if (input.schema_version !== TEMPLATE_MANIFEST_SCHEMA_VERSION) {
    errors.push(`schema_version must be \"${TEMPLATE_MANIFEST_SCHEMA_VERSION}\".`);
  }

  if (typeof input.template_id !== "string" || !input.template_id) {
    errors.push("template_id must be a non-empty string.");
  }

  if (typeof input.artifact_type !== "string" || !input.artifact_type) {
    errors.push("artifact_type must be a non-empty string.");
  }

  if (input.output_mode !== "deck" && input.output_mode !== "sheet") {
    errors.push("output_mode must be \"deck\" or \"sheet\".");
  }

  if (input.output_mode === "deck") {
    if (!Array.isArray(input.front_slots) || input.front_slots.length === 0) {
      errors.push("deck manifests require front_slots[].");
    }

    if (Array.isArray(input.front_slots)) {
      input.front_slots.forEach((slot, index) =>
        validateSlotDefinition(slot, `front_slots[${index}]`, errors)
      );
    }

    if (Array.isArray(input.back_slots)) {
      input.back_slots.forEach((slot, index) =>
        validateSlotDefinition(slot, `back_slots[${index}]`, errors)
      );
    }
  }

  if (input.output_mode === "sheet") {
    if (!Number.isInteger(input.cards_per_page) || input.cards_per_page <= 0) {
      errors.push("sheet manifests require cards_per_page as a positive integer.");
    }

    if (!Array.isArray(input.front_repeat_slots) || input.front_repeat_slots.length === 0) {
      errors.push("sheet manifests require front_repeat_slots[].");
    }

    if (Array.isArray(input.front_repeat_slots)) {
      input.front_repeat_slots.forEach((slot, index) =>
        validateSlotDefinition(slot, `front_repeat_slots[${index}]`, errors, { requirePattern: true })
      );
    }

    if (Array.isArray(input.back_repeat_slots)) {
      input.back_repeat_slots.forEach((slot, index) =>
        validateSlotDefinition(slot, `back_repeat_slots[${index}]`, errors, { requirePattern: true })
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function loadTemplateManifest(filePath) {
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const result = validateTemplateManifest(manifest);
  if (!result.valid) {
    throw new Error(`Invalid template manifest:\n- ${result.errors.join("\n- ")}`);
  }
  return manifest;
}
