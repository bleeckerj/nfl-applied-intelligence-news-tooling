import test from "node:test";
import assert from "node:assert/strict";
import { validateTemplateManifest } from "../tools/lib/template-manifest.mjs";

test("validateTemplateManifest accepts deck manifest", () => {
  const manifest = {
    schema_version: "1.0",
    template_id: "response_card_deck_v1",
    artifact_type: "cards",
    output_mode: "deck",
    front_slots: [
      { name: "CARD_TITLE", kind: "text", source: "title" },
      { name: "CARD_IMAGE", kind: "image", source: "front_image" },
    ],
  };

  const result = validateTemplateManifest(manifest);
  assert.equal(result.valid, true);
});

test("validateTemplateManifest rejects invalid sheet slot pattern", () => {
  const manifest = {
    schema_version: "1.0",
    template_id: "response_card_sheet_v1",
    artifact_type: "cards",
    output_mode: "sheet",
    cards_per_page: 9,
    front_repeat_slots: [{ name_pattern: "C_TITLE", kind: "text", source: "title" }],
  };

  const result = validateTemplateManifest(manifest);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /name_pattern/);
});

test("validateTemplateManifest allows passthrough slot and checks format values", () => {
  const validManifest = {
    schema_version: "1.0",
    template_id: "response_card_deck_passthrough_v1",
    artifact_type: "cards",
    output_mode: "deck",
    front_slots: [
      { name: "title", kind: "text" },
      { name: "alias_candidates", kind: "text", format: { array: "newline", limit: 3 } },
    ],
  };

  const validResult = validateTemplateManifest(validManifest);
  assert.equal(validResult.valid, true);

  const invalidManifest = {
    schema_version: "1.0",
    template_id: "response_card_deck_bad_format_v1",
    artifact_type: "cards",
    output_mode: "deck",
    front_slots: [{ name: "tags", kind: "text", format: { array: "rows" } }],
  };

  const invalidResult = validateTemplateManifest(invalidManifest);
  assert.equal(invalidResult.valid, false);
  assert.match(invalidResult.errors.join("\n"), /format\.array/);
});
