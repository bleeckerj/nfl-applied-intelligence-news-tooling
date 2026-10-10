import { ASSIGNMENT_SCHEMA_VERSION, validateAssignmentDocument } from "./assignment-format.mjs";

function chunkArray(items, size) {
  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function toDisplayText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.join(", ");
  return JSON.stringify(value);
}

function getPathValue(sourceObject, pathExpression) {
  if (!pathExpression) return undefined;

  const paths = Array.isArray(pathExpression)
    ? pathExpression
    : String(pathExpression)
        .split("||")
        .map((path) => path.trim())
        .filter(Boolean);

  for (const path of paths) {
    const parts = path.split(".");
    let current = sourceObject;
    for (const part of parts) {
      if (current == null) {
        current = undefined;
        break;
      }
      current = current[part];
    }
    if (current !== undefined && current !== null && current !== "") {
      return current;
    }
  }

  return undefined;
}

function getPassthroughValue(context, slotName) {
  const candidates = [
    slotName,
    slotName.toLowerCase(),
    slotName.replace(/^CARD_/, "").toLowerCase(),
    slotName.replace(/^C\d+_/, "").toLowerCase(),
  ];

  for (const key of candidates) {
    if (context[key] !== undefined && context[key] !== null) return context[key];
    if (context.raw && context.raw[key] !== undefined && context.raw[key] !== null) return context.raw[key];
  }

  return undefined;
}

function formatArrayValue(values, format) {
  const mode = format?.array || "join";
  const separator = format?.separator !== undefined ? format.separator : ", ";
  const limit = format?.limit;
  const normalized = Array.isArray(values) ? values : [];
  const sliced = Number.isInteger(limit) ? normalized.slice(0, limit) : normalized;

  if (mode === "newline") return sliced.map(toDisplayText).join("\n");
  if (mode === "bullet") return sliced.map((item) => `- ${toDisplayText(item)}`).join("\n");
  if (mode === "json") return JSON.stringify(sliced);
  return sliced.map(toDisplayText).join(separator);
}

function formatSlotValue(rawValue, slotDef) {
  if (Array.isArray(rawValue)) {
    return formatArrayValue(rawValue, slotDef.format);
  }
  return toDisplayText(rawValue);
}

function compileSlot(slotDef, context, slotName, errors) {
  const hasExplicitSource = slotDef.source !== undefined;
  const value = hasExplicitSource
    ? getPathValue(context, slotDef.source)
    : getPassthroughValue(context, slotName);
  const required = Boolean(slotDef.required);

  if (slotDef.kind === "text") {
    const text = value === undefined ? (slotDef.default ?? "") : formatSlotValue(value, slotDef);
    if (required && !text) {
      errors.push(`Missing required text value for slot ${slotName}.`);
    }
    return {
      name: slotName,
      kind: "text",
      text,
      style: slotDef.style,
      required,
    };
  }

  if (slotDef.kind === "image") {
    const srcCandidate = value === undefined ? slotDef.default : value;
    const src = typeof srcCandidate === "string" ? srcCandidate : srcCandidate?.src;

    if (required && !src) {
      errors.push(`Missing required image value for slot ${slotName}.`);
    }

    return {
      name: slotName,
      kind: "image",
      src: src || "",
      caption: slotDef.caption ? toDisplayText(getPathValue(context, slotDef.caption)) : undefined,
      fit: slotDef.fit,
      required,
    };
  }

  errors.push(`Unsupported slot kind for ${slotName}: ${slotDef.kind}`);
  return null;
}

function makePageId(prefix, index) {
  return `${prefix}_${String(index + 1).padStart(3, "0")}`;
}

function compileDeckPages(deck, manifest, options, errors) {
  const pages = [];

  deck.cards.forEach((card, index) => {
    const frontSlots = manifest.front_slots
      .map((slotDef) => compileSlot(slotDef, card, slotDef.name, errors))
      .filter(Boolean);

    pages.push({
      id: makePageId("card_front", index),
      side: "front",
      card_ref: card.card_id,
      slots: frontSlots,
    });

    const shouldBuildBack =
      options.includeBack && Array.isArray(manifest.back_slots) && manifest.back_slots.length > 0;

    if (shouldBuildBack) {
      const backContext = {
        ...card,
        back: card.back || {},
      };

      const hasBackPayload = Boolean(card.back?.text || card.back?.image);
      if (!hasBackPayload && options.skipEmptyBack !== false) {
        return;
      }

      const backSlots = manifest.back_slots
        .map((slotDef) => compileSlot(slotDef, backContext, slotDef.name, errors))
        .filter(Boolean);

      pages.push({
        id: makePageId("card_back", index),
        side: "back",
        card_ref: card.card_id,
        slots: backSlots,
      });
    }
  });

  return pages;
}

function compileSheetSide(sheetCards, repeatSlots, options, errors, sideLabel) {
  const slots = [];

  sheetCards.forEach((card, localIndex) => {
    repeatSlots.forEach((slotDef) => {
      const slotName = slotDef.name_pattern.replace(/\{index\}/g, String(localIndex + 1));
      const context =
        sideLabel === "back"
          ? {
              ...card,
              back: card.back || {},
            }
          : card;

      const slot = compileSlot(slotDef, context, slotName, errors);
      if (slot) slots.push(slot);
    });
  });

  if (options.strictCardCount && sheetCards.length < options.cardsPerPage) {
    errors.push(
      `Sheet contains ${sheetCards.length} cards, below required cardsPerPage=${options.cardsPerPage}.`
    );
  }

  return slots;
}

function compileSheetPages(deck, manifest, options, errors) {
  const cardsPerPage = manifest.cards_per_page;
  const chunks = chunkArray(deck.cards, cardsPerPage);
  const pages = [];

  chunks.forEach((chunk, chunkIndex) => {
    const frontSlots = compileSheetSide(
      chunk,
      manifest.front_repeat_slots,
      { ...options, cardsPerPage },
      errors,
      "front"
    );

    pages.push({
      id: makePageId("sheet_front", chunkIndex),
      side: "front",
      slots: frontSlots,
    });

    const shouldBuildBack =
      options.includeBack &&
      Array.isArray(manifest.back_repeat_slots) &&
      manifest.back_repeat_slots.length > 0;

    if (!shouldBuildBack) return;

    const backChunk = manifest.back_card_order === "reverse" ? [...chunk].reverse() : chunk;

    const hasAnyBackPayload = backChunk.some((card) => card.back?.text || card.back?.image);
    if (!hasAnyBackPayload && options.skipEmptyBack !== false) {
      return;
    }

    const backSlots = compileSheetSide(
      backChunk,
      manifest.back_repeat_slots,
      { ...options, cardsPerPage },
      errors,
      "back"
    );

    pages.push({
      id: makePageId("sheet_back", chunkIndex),
      side: "back",
      slots: backSlots,
    });
  });

  return pages;
}

export function compileCardAssignments(deck, manifest, options = {}) {
  const errors = [];
  const outputMode = options.mode || manifest.output_mode;

  let pages = [];
  if (outputMode === "deck") {
    pages = compileDeckPages(deck, manifest, options, errors);
  } else if (outputMode === "sheet") {
    pages = compileSheetPages(deck, manifest, options, errors);
  } else {
    errors.push(`Unsupported output mode: ${outputMode}`);
  }

  const document = {
    schema_version: ASSIGNMENT_SCHEMA_VERSION,
    artifact_type: "cards",
    template_id: manifest.template_id,
    output_mode: outputMode,
    metadata: {
      generated_at: new Date().toISOString(),
      deck_name: deck.deck_name,
      card_type: deck.card_type,
      cards_total: deck.cards.length,
    },
    pages,
  };

  const validation = validateAssignmentDocument(document);
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  if (errors.length > 0) {
    throw new Error(`Card assignment compilation failed:\n- ${errors.join("\n- ")}`);
  }

  return document;
}
