import fs from "node:fs";
import path from "node:path";
import { normalizeAssignmentDocument } from "./lib/assignment-format.mjs";

function parseArgs(argv) {
  const result = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--input") {
      result.inputPath = argv[++i];
    } else if (arg === "--output") {
      result.outputPath = argv[++i];
    } else if (arg === "--template-id") {
      result.templateId = argv[++i];
    } else if (arg === "--artifact-type") {
      result.artifactType = argv[++i];
    } else if (arg === "--output-mode") {
      result.outputMode = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  node tools/migrate-assignments.mjs --input <legacy-or-v2.json> --output <v2.json>
    [--template-id <id>] [--artifact-type newspaper|cards] [--output-mode deck|sheet]`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  if (!args.inputPath || !args.outputPath) {
    printUsage();
    throw new Error("Missing --input or --output.");
  }

  const inputPath = path.resolve(process.cwd(), args.inputPath);
  const outputPath = path.resolve(process.cwd(), args.outputPath);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const { document, warnings } = normalizeAssignmentDocument(raw, {
    allowLegacy: true,
    overrides: {
      templateId: args.templateId,
      artifactType: args.artifactType,
      outputMode: args.outputMode,
    },
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");

  console.log(`Wrote v2 assignment document: ${outputPath}`);
  warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
