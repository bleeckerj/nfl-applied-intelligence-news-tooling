import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function parseArgs(argv) {
  const result = {
    mode: null,
    includeBack: true,
    preset: "[High Quality Print]",
    strict: true,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "--cards") {
      result.cardsPath = argv[++i];
    } else if (arg === "--manifest") {
      result.manifestPath = argv[++i];
    } else if (arg === "--assignments") {
      result.assignmentsPath = argv[++i];
    } else if (arg === "--template") {
      result.templatePath = argv[++i];
    } else if (arg === "--output") {
      result.outputPath = argv[++i];
    } else if (arg === "--mode") {
      result.mode = argv[++i];
    } else if (arg === "--preset") {
      result.preset = argv[++i];
    } else if (arg === "--no-back") {
      result.includeBack = false;
    } else if (arg === "--strict") {
      const value = String(argv[++i] || "true").toLowerCase();
      result.strict = !(value === "false" || value === "0" || value === "no");
    } else if (arg === "--keep-assignments") {
      result.keepAssignments = true;
    } else if (arg === "--help" || arg === "-h") {
      result.help = true;
    }
  }

  return result;
}

function printUsage() {
  console.log(`Usage:
  Cards flow:
    node tools/build-print-pdf.mjs \\
      --cards <deck.json> --manifest <manifest.json> --template <template.indt> --output <result.pdf> \\
      [--mode deck|sheet] [--no-back] [--preset "[High Quality Print]"]

  Existing assignments flow:
    node tools/build-print-pdf.mjs \\
      --assignments <assignments.json> --template <template.indt> --output <result.pdf> \\
      [--preset "[High Quality Print]"]`);
}

function runNodeScript(args, label) {
  const runResult = spawnSync("node", args, {
    stdio: "inherit",
    cwd: process.cwd(),
  });

  if (runResult.status !== 0) {
    throw new Error(`${label} failed.`);
  }
}

function resolvePath(inputPath, label) {
  if (!inputPath) {
    throw new Error(`Missing ${label}.`);
  }
  const resolved = path.resolve(process.cwd(), inputPath);
  return resolved;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return;
  }

  const templatePath = resolvePath(args.templatePath, "--template");
  const outputPath = resolvePath(args.outputPath, "--output");

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${templatePath}`);
  }

  let assignmentsPath;
  if (args.assignmentsPath) {
    assignmentsPath = resolvePath(args.assignmentsPath, "--assignments");
    if (!fs.existsSync(assignmentsPath)) {
      throw new Error(`Assignments file not found: ${assignmentsPath}`);
    }
  } else {
    if (!args.cardsPath || !args.manifestPath) {
      printUsage();
      throw new Error("Either --assignments OR (--cards and --manifest) is required.");
    }

    const cardsPath = resolvePath(args.cardsPath, "--cards");
    const manifestPath = resolvePath(args.manifestPath, "--manifest");
    if (!fs.existsSync(cardsPath)) throw new Error(`Cards file not found: ${cardsPath}`);
    if (!fs.existsSync(manifestPath)) throw new Error(`Manifest file not found: ${manifestPath}`);

    const compiledDir = path.join(process.cwd(), "dist", "print");
    fs.mkdirSync(compiledDir, { recursive: true });
    assignmentsPath = path.join(compiledDir, `${path.basename(outputPath, ".pdf")}.assignments.json`);

    const compileArgs = [
      "tools/compile-print-assignments.mjs",
      "--cards",
      cardsPath,
      "--manifest",
      manifestPath,
      "--output",
      assignmentsPath,
    ];

    if (args.mode) {
      compileArgs.push("--mode", args.mode);
    }
    if (!args.includeBack) {
      compileArgs.push("--no-back");
    }

    runNodeScript(compileArgs, "Assignment compilation");
  }

  runNodeScript(
    [
      "tools/run-id-script.mjs",
      "--file",
      templatePath,
      "--script",
      "tools/ingest-assignments.jsx",
      "--arg",
      assignmentsPath,
      "--arg",
      `strict=${args.strict ? "true" : "false"}`,
    ],
    "InDesign ingest"
  );

  runNodeScript(
    [
      "tools/run-id-script.mjs",
      "--script",
      "tools/export-pdf.jsx",
      "--arg",
      outputPath,
      "--arg",
      `preset=${args.preset}`,
    ],
    "InDesign PDF export"
  );

  if (!args.keepAssignments && !args.assignmentsPath) {
    try {
      fs.unlinkSync(assignmentsPath);
    } catch {
      // ignore cleanup failures
    }
  }

  console.log(`Print PDF created: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
