function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function toStringSafe(value) {
  if (value == null) return "";
  return typeof value === "string" ? value : String(value);
}

function formatTrackEffects(trackEffects) {
  if (!trackEffects || typeof trackEffects !== "object") return "";
  const entries = Object.keys(trackEffects)
    .map((track) => {
      const raw = Number(trackEffects[track]);
      if (Number.isNaN(raw)) return null;
      const prefix = raw > 0 ? "+" : "";
      return `${track}: ${prefix}${raw}`;
    })
    .filter(Boolean);
  // InDesign text frames honor hard returns, so keep each effect on its own line.
  return entries.join("\n");
}

function formatResponseCard(card) {
  return {
    subtitle: toStringSafe(card.primary_alias),
    body: toStringSafe(card.what_this_is),
    detail: toStringSafe(card.why_this_cost_effect),
    tradeoff: toStringSafe(card.tradeoff),
    effects_text: formatTrackEffects(card.track_effects),
    metric_text: card.cost_capacity != null ? `Capacity Cost: ${card.cost_capacity}` : "",
  };
}

function formatImplicationCard(card) {
  const titoDelta = card.tito_delta != null ? `Tito Delta: ${card.tito_delta > 0 ? "+" : ""}${card.tito_delta}` : "";
  const cooldown = card.cooldown_turns != null ? `Cooldown: ${card.cooldown_turns}` : "";

  return {
    subtitle: toStringSafe(card.band),
    body: toStringSafe(card.description),
    detail: toStringSafe(card.trigger_rule),
    tradeoff: toStringSafe(card.trigger_bands),
    effects_text: [titoDelta, cooldown].filter(Boolean).join(" | "),
    metric_text: toArray(card.suggested_response_tags).join(", "),
  };
}

function normalizeBack(back) {
  if (!back || typeof back !== "object") {
    return null;
  }

  const text = toStringSafe(back.text || back.body || back.description);
  const image = toStringSafe(back.image?.src || back.image || back.image_path);

  if (!text && !image) return null;

  return {
    text,
    image,
  };
}

function normalizeOneCard(card, deckType, deckName) {
  const number = Number(card.number || 0);
  const cardId = toStringSafe(card.card_id || card.implication_id || `card_${number || "x"}`);

  const formatted = deckType === "implication" ? formatImplicationCard(card) : formatResponseCard(card);
  const tags = deckType === "implication" ? toArray(card.suggested_response_tags) : toArray(card.tags);

  return {
    number,
    card_id: cardId,
    deck_type: deckType,
    deck_name: deckName,
    title: toStringSafe(card.title),
    subtitle: formatted.subtitle,
    category: toStringSafe(card.category || card.implication_type || ""),
    tags,
    body: formatted.body,
    detail: formatted.detail,
    tradeoff: formatted.tradeoff,
    effects_text: formatted.effects_text,
    metric_text: formatted.metric_text,
    front_image: toStringSafe(card.image?.src || card.image || card.image_path),
    back: normalizeBack(card.back),
    raw: card,
  };
}

export function normalizeCardDeck(rawDeck) {
  if (!rawDeck || typeof rawDeck !== "object") {
    throw new Error("Card deck input must be an object.");
  }

  const cards = toArray(rawDeck.cards);
  if (cards.length === 0) {
    throw new Error("Card deck input contains no cards.");
  }

  const deckType = toStringSafe(rawDeck.card_type || "response") || "response";
  const deckName = toStringSafe(rawDeck.deck_name || "Untitled Deck");

  const normalizedCards = cards.map((card) => normalizeOneCard(card, deckType, deckName));

  return {
    deck_name: deckName,
    set_id: toStringSafe(rawDeck.set_id),
    card_type: deckType,
    tracks: toArray(rawDeck.tracks),
    glossary: rawDeck.glossary || {},
    cards: normalizedCards,
  };
}
