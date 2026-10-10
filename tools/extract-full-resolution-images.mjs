#!/usr/bin/env node

import fs from "fs";
import path from "path";

const HELP_TEXT = `Extract full-resolution linked images referenced by a structured InDesign JSON file.

Usage:
  node tools/extract-full-resolution-images.mjs <path-to-structured.json> [options]
  npm run images:fullres -- <path-to-structured.json> [options]

Options:
  -o, --output <dir>   Output directory. Default: sibling "full-resolution" folder
                       next to the structured JSON, typically adjacent to "thumbnails".
  --dry-run            Report what would be copied without writing files.
  -h, --help           Show this help output.

Accepted input:
  - *_structured.json
  - *_structured_with_thumbs.json

Behavior:
  - Reads Image/Graphic components from the structured JSON.
  - Copies unique linked source assets at full resolution.
  - Skips missing, embedded, or invalid links and reports them.
  - Preserves source modification times.
`;

function printHelp() {
  console.log(HELP_TEXT);
}

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = [...argv];
  const options = {
    input: null,
    output: null,
    dryRun: false,
  };

  while (args.length > 0) {
    const arg = args.shift();
    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "-o" || arg === "--output") {
      const value = args.shift();
      if (!value) fail(`Missing value for ${arg}`);
      options.output = value;
      continue;
    }
    if (arg.startsWith("-")) {
      fail(`Unknown option: ${arg}`);
    }
    if (options.input) {
      fail(`Unexpected extra argument: ${arg}`);
    }
    options.input = arg;
  }

  if (!options.input) {
    printHelp();
    process.exit(1);
  }

  return options;
}

function makeUniqueDestination(baseDir, filename, seenNames) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let counter = 2;

  while (seenNames.has(candidate) || fs.existsSync(path.join(baseDir, candidate))) {
    candidate = `${parsed.name}__${counter}${parsed.ext}`;
    counter += 1;
  }

  seenNames.add(candidate);
  return path.join(baseDir, candidate);
}

function collectImagePaths(data) {
  const images = [];
  for (const article of data.articles || []) {
    for (const component of article.components || []) {
      if (component?.type !== "Image/Graphic") continue;
      if (typeof component.content !== "string") continue;
      images.push(component.content);
    }
  }
  return images;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(options.input);

  if (!fs.existsSync(inputPath)) {
    fail(`Input JSON not found: ${inputPath}`);
  }

  const inputDir = path.dirname(inputPath);
  const outputDir = path.resolve(options.output || path.join(inputDir, "full-resolution"));

  console.log(`Reading structured JSON: ${inputPath}`);
  const raw = fs.readFileSync(inputPath, "utf8");
  const data = JSON.parse(raw);
  const imagePaths = collectImagePaths(data);
  const uniquePaths = [...new Set(imagePaths)];

  console.log(`Found ${imagePaths.length} image references (${uniquePaths.length} unique source paths)`);
  console.log(`Output directory: ${outputDir}`);
  if (options.dryRun) {
    console.log("Mode: dry run");
  }

  if (!options.dryRun) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let copied = 0;
  let missing = 0;
  let skipped = 0;
  const seenNames = new Set();
  const manifest = [];

  for (const sourcePath of uniquePaths) {
    if (!sourcePath || sourcePath === "embedded-or-missing") {
      skipped += 1;
      continue;
    }

    const absoluteSource = path.resolve(sourcePath);
    if (!fs.existsSync(absoluteSource)) {
      console.warn(`Missing source: ${absoluteSource}`);
      missing += 1;
      continue;
    }

    const destination = makeUniqueDestination(outputDir, path.basename(absoluteSource), seenNames);
    manifest.push({
      source: absoluteSource,
      destination,
    });

    if (!options.dryRun) {
      fs.copyFileSync(absoluteSource, destination);
      const stats = fs.statSync(absoluteSource);
      fs.utimesSync(destination, stats.atime, stats.mtime);
    }

    copied += 1;
    console.log(`[${copied}/${uniquePaths.length}] ${path.basename(absoluteSource)}`);
  }

  if (!options.dryRun) {
    const manifestPath = path.join(outputDir, "manifest.json");
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest written: ${manifestPath}`);
  }

  console.log("");
  console.log("Done.");
  console.log(`Copied: ${copied}`);
  console.log(`Missing: ${missing}`);
  console.log(`Skipped embedded/invalid: ${skipped}`);
}

main().catch((error) => {
  console.error(error?.stack || String(error));
  process.exit(1);
});
