import fs from "node:fs";
import path from "node:path";
import { validateTemplateManifest } from "./lib/template-manifest.mjs";
import { normalizeAssignmentDocument, validateAssignmentDocument } from "./lib/assignment-format.mjs";
import { normalizeCardDeck } from "./lib/card-normalizer.mjs";

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--manifest") {
      result.manifestPath = argv[++i];
    } else if (arg === "--assignments") {
      result.assignmentsPath = argv[++i];
    } else if (arg === "--cards") {
      result.cardsPath = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function printUsage() {
  console.log(
    `Usage: node tools/validate-print-schemas.mjs [--manifest <manifest.json>] [--assignments <assignments.json>] [--cards <deck.json>]`
  );
}

function validateManifest(manifestPath) {
  const resolved = path.resolve(process.cwd(), manifestPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Manifest not found: ${resolved}`);
  }

  const manifest = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const result = validateTemplateManifest(manifest);

  if (!result.valid) {
    throw new Error(`Manifest invalid (${resolved}):\n- ${result.errors.join("\n- ")}`);
  }

  console.log(`Manifest valid: ${resolved}`);
}

function validateAssignments(assignmentsPath) {
  const resolved = path.resolve(process.cwd(), assignmentsPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Assignments not found: ${resolved}`);
  }

  const raw = JSON.parse(fs.readFileSync(resolved, "utf8"));
  const { document, warnings } = normalizeAssignmentDocument(raw, { allowLegacy: true });
  const result = validateAssignmentDocument(document);

  if (!result.valid) {
    throw new Error(`Assignments invalid (${resolved}):\n- ${result.errors.join("\n- ")}`);
  }

  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
  console.log(`Assignments valid: ${resolved}`);
}

function listSlotDefs(manifest) {
  const slots = [];
  const arrays = ["front_slots", "back_slots", "front_repeat_slots", "back_repeat_slots"];
  arrays.forEach((key) => {
    if (Array.isArray(manifest[key])) slots.push(...manifest[key]);
  });
  return slots;
}

function listPaths(expr) {
  if (!expr) return [];
  if (Array.isArray(expr)) return expr.map(String);
  return String(expr)
    .split("||")
    .map((p) => p.trim())
    .filter(Boolean);
}

function getValueByPath(obj, pathExpr) {
  const parts = pathExpr.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function validateManifestAgainstCards(manifestPath, cardsPath) {
  const manifestResolved = path.resolve(process.cwd(), manifestPath);
  const cardsResolved = path.resolve(process.cwd(), cardsPath);
  if (!fs.existsSync(manifestResolved)) throw new Error(`Manifest not found: ${manifestResolved}`);
  if (!fs.existsSync(cardsResolved)) throw new Error(`Cards not found: ${cardsResolved}`);

  const manifest = JSON.parse(fs.readFileSync(manifestResolved, "utf8"));
  const manifestValidation = validateTemplateManifest(manifest);
  if (!manifestValidation.valid) {
    throw new Error(`Manifest invalid (${manifestResolved}):\n- ${manifestValidation.errors.join("\n- ")}`);
  }

  const rawCards = JSON.parse(fs.readFileSync(cardsResolved, "utf8"));
  const deck = normalizeCardDeck(rawCards);
  const sample = deck.cards[0];
  if (!sample) throw new Error("Cards file contains no cards.");

  const slotDefs = listSlotDefs(manifest);
  const missingSources = [];
  const usedTopLevel = new Set();
  const usedRawFields = new Set();

  slotDefs.forEach((slot) => {
    const sources = listPaths(slot.source);
    if (sources.length === 0) return; // passthrough slot

    let resolved = false;
    sources.forEach((sourceExpr) => {
      const value = getValueByPath(sample, sourceExpr);
      if (value !== undefined && value !== null) resolved = true;
      const top = sourceExpr.split(".")[0];
      if (top) usedTopLevel.add(top);
      if (sourceExpr.indexOf("raw.") === 0) {
        const rawField = sourceExpr.slice("raw.".length).split(".")[0];
        if (rawField) usedRawFields.add(rawField);
      }
    });

    if (!resolved) {
      missingSources.push(`${slot.name}: ${sources.join(" || ")}`);
    }
  });

  if (missingSources.length > 0) {
    throw new Error(
      `Manifest sources not found in sample card (${cardsResolved}):\n- ${missingSources.join("\n- ")}`
    );
  }

  const rawFields = Object.keys(sample.raw || {});
  const unmappedRawFields = rawFields.filter((field) => !usedTopLevel.has(field) && !usedRawFields.has(field));
  if (unmappedRawFields.length > 0) {
    console.warn(
      `Warning: Sample card has unmapped raw fields (${unmappedRawFields.length}): ${unmappedRawFields.join(", ")}`
    );
  }

  console.log(`Manifest/cards mapping valid: ${manifestResolved} <-> ${cardsResolved}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || (!args.manifestPath && !args.assignmentsPath && !args.cardsPath)) {
    printUsage();
    if (!args.help) {
      throw new Error("Provide at least one of --manifest, --assignments, or --cards with --manifest.");
    }
    return;
  }

  if (args.manifestPath) {
    validateManifest(args.manifestPath);
  }

  if (args.assignmentsPath) {
    validateAssignments(args.assignmentsPath);
  }

  if (args.cardsPath) {
    if (!args.manifestPath) {
      throw new Error("--cards requires --manifest.");
    }
    validateManifestAgainstCards(args.manifestPath, args.cardsPath);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
