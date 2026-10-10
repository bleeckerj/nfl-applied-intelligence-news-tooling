import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCardDeck } from "../tools/lib/card-normalizer.mjs";
import { compileCardAssignments } from "../tools/lib/card-assignment-compiler.mjs";

const responseDeckFixture = {
  deck_name: "AGI Wars Response Cards",
  card_type: "response",
  cards: [
    {
      number: 1,
      card_id: "response_01",
      title: "Credentialed API Gate",
      primary_alias: "Show Your ID",
      category: "Technical",
      tags: ["Lab"],
      track_effects: { "Human Control": 1 },
      tradeoff: "Slower rollout",
      what_this_is: "Seatbelts for model access",
      why_this_cost_effect: "Control gain",
      image: "images/front-1.jpg",
      back: {
        text: "Back text one",
        image: "images/back-1.jpg",
      },
    },
    {
      number: 2,
      card_id: "response_02",
      title: "Sandboxed Tool Permissions",
      primary_alias: "Don't Wander Off",
      category: "Technical",
      tags: ["Infra"],
      what_this_is: "Constrained tool access",
      image: "images/front-2.jpg",
    },
  ],
};

test("compileCardAssignments creates deck pages", () => {
  const manifest = {
    schema_version: "1.0",
    template_id: "response_card_deck_v1",
    artifact_type: "cards",
    output_mode: "deck",
    front_slots: [
      { name: "CARD_TITLE", kind: "text", source: "title", required: true },
      { name: "CARD_BODY", kind: "text", source: "body" },
      { name: "CARD_IMAGE", kind: "image", source: "front_image" },
    ],
    back_slots: [{ name: "CARD_BACK_TEXT", kind: "text", source: "back.text" }],
  };

  const normalized = normalizeCardDeck(responseDeckFixture);
  const output = compileCardAssignments(normalized, manifest, { mode: "deck", includeBack: true });

  assert.equal(output.pages.length, 3);
  assert.equal(output.pages[0].side, "front");
  assert.equal(output.pages[1].side, "back");
  assert.equal(output.pages[2].side, "front");
});

test("compileCardAssignments creates sheet pages", () => {
  const manifest = {
    schema_version: "1.0",
    template_id: "response_card_sheet_v1",
    artifact_type: "cards",
    output_mode: "sheet",
    cards_per_page: 2,
    front_repeat_slots: [
      { name_pattern: "C{index}_TITLE", kind: "text", source: "title", required: true },
      { name_pattern: "C{index}_IMAGE", kind: "image", source: "front_image" },
    ],
  };

  const normalized = normalizeCardDeck(responseDeckFixture);
  const output = compileCardAssignments(normalized, manifest, { mode: "sheet", includeBack: false });

  assert.equal(output.pages.length, 1);
  assert.equal(output.pages[0].slots.length, 4);
  assert.equal(output.pages[0].slots[0].name, "C1_TITLE");
  assert.equal(output.pages[0].slots[2].name, "C2_TITLE");
});

test("compileCardAssignments supports passthrough and array formatting", () => {
  const manifest = {
    schema_version: "1.0",
    template_id: "response_card_deck_passthrough_v1",
    artifact_type: "cards",
    output_mode: "deck",
    front_slots: [
      { name: "title", kind: "text", required: true },
      { name: "tags", kind: "text", format: { array: "newline", limit: 2 } },
    ],
  };

  const normalized = normalizeCardDeck(responseDeckFixture);
  const output = compileCardAssignments(normalized, manifest, { mode: "deck", includeBack: false });

  const slots = output.pages[0].slots;
  const titleSlot = slots.find((slot) => slot.name === "title");
  const tagsSlot = slots.find((slot) => slot.name === "tags");

  assert.equal(titleSlot.text, "Credentialed API Gate");
  assert.match(tagsSlot.text, /Lab/);
  assert.equal(tagsSlot.text.split("\n").length, 1);
});
