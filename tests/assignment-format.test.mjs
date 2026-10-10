import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSIGNMENT_SCHEMA_VERSION,
  normalizeAssignmentDocument,
  validateAssignmentDocument,
} from "../tools/lib/assignment-format.mjs";

test("validateAssignmentDocument accepts v2 assignment document", () => {
  const document = {
    schema_version: ASSIGNMENT_SCHEMA_VERSION,
    artifact_type: "cards",
    template_id: "response_card_deck_v1",
    output_mode: "deck",
    pages: [
      {
        id: "p1",
        slots: [
          { name: "CARD_TITLE", kind: "text", text: "Card title" },
          { name: "CARD_IMAGE", kind: "image", src: "images/a.jpg" },
        ],
      },
    ],
  };

  const result = validateAssignmentDocument(document);
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("normalizeAssignmentDocument adapts legacy assignments", () => {
  const legacy = {
    metadata: {
      templateName: "legacy_news_template",
    },
    pages: [
      {
        id: "p1",
        assignments: {
          TF_P1_1: { content: "Hello", style: "Body Text" },
          Obj_P1_2: { src: "images/photo.jpg" },
        },
      },
    ],
  };

  const { document, warnings } = normalizeAssignmentDocument(legacy, { allowLegacy: true });

  assert.equal(document.schema_version, ASSIGNMENT_SCHEMA_VERSION);
  assert.equal(document.template_id, "legacy_news_template");
  assert.equal(document.pages.length, 1);
  assert.equal(document.pages[0].slots.length, 2);
  assert.equal(warnings.length, 1);
});
