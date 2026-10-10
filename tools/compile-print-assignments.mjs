import fs from "node:fs";
import path from "node:path";
import { normalizeCardDeck } from "./lib/card-normalizer.mjs";
import { compileCardAssignments } from "./lib/card-assignment-compiler.mjs";
import { loadTemplateManifest } from "./lib/template-manifest.mjs";

function parseArgs(argv) {
  const result = {
    mode: null,
    includeBack: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--cards") {
      result.cardsPath = argv[++i];
    } else if (arg === "--manifest") {
      result.manifestPath = argv[++i];
    } else if (arg === "--output") {
      result.outputPath = argv[++i];
    } else if (arg === "--mode") {
      result.mode = argv[++i];
    } else if (arg === "--no-back") {
      result.includeBack = false;
    } else if (arg === "--strict-card-count") {
      result.strictCardCount = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  node tools/compile-print-assignments.mjs \\
    --cards <deck.json> \\
    --manifest <template-manifest.json> \\
    --output <assignments.json> \\
    [--mode deck|sheet] [--no-back] [--strict-card-count]`);
}

function ensureFile(pathValue, label) {
  if (!pathValue || !fs.existsSync(pathValue)) {
    throw new Error(`${label} not found: ${pathValue || "<missing>"}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.cardsPath || !args.manifestPath || !args.outputPath) {
    printUsage();
    throw new Error("Missing required arguments.");
  }

  const cardsPath = path.resolve(process.cwd(), args.cardsPath);
  const manifestPath = path.resolve(process.cwd(), args.manifestPath);
  const outputPath = path.resolve(process.cwd(), args.outputPath);

  ensureFile(cardsPath, "Cards JSON");
  ensureFile(manifestPath, "Template manifest");

  const rawCards = JSON.parse(fs.readFileSync(cardsPath, "utf8"));
  const manifest = loadTemplateManifest(manifestPath);
  const deck = normalizeCardDeck(rawCards);

  if (manifest.artifact_type !== "cards") {
    throw new Error(`Manifest artifact_type must be \"cards\", got: ${manifest.artifact_type}`);
  }

  if (manifest.deck_type && manifest.deck_type !== deck.card_type) {
    throw new Error(
      `Manifest deck_type \"${manifest.deck_type}\" does not match deck card_type \"${deck.card_type}\".`
    );
  }

  const assignments = compileCardAssignments(deck, manifest, {
    mode: args.mode || manifest.output_mode,
    includeBack: args.includeBack,
    strictCardCount: Boolean(args.strictCardCount),
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(assignments, null, 2)}\n`, "utf8");

  console.log(`Compiled assignments: ${outputPath}`);
  console.log(
    `Template=${assignments.template_id} mode=${assignments.output_mode} pages=${assignments.pages.length} cards=${deck.cards.length}`
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
