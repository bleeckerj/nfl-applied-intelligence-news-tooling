# Production Automation Tools

This folder centers on the current production backend: Adobe InDesign.

The stable contract is backend-agnostic:

- named template slots
- assignment schema `2.0`
- template manifests
- backend-specific ingest/export runners

Future backends should plug into that contract rather than redefine the repo around a tool-specific model.

## Canonical Production Pipeline

1. Export or define named template slots.
2. Build assignment JSON (schema v2.0).
3. Ingest into InDesign.
4. Export PDF.

## Canonical CLI

### `run-id-script.mjs`
Run a JSX script inside InDesign, optionally opening a document first.

```bash
npm run indesign:run -- --script tools/export-layout-map.jsx
npm run indesign:run -- --file templates/MyTemplate.indt --script tools/ingest-assignments.jsx --arg dist/print/assignments.json
```

### `compile-print-assignments.mjs`
Compile deck JSON + template manifest into assignment schema v2.0.

```bash
npm run assignments:compile -- \
  --cards /Users/julian/Code/nfl-agi-wars/cards_01/data/response-cards-50.json \
  --manifest /Users/julian/Code/nfl-agi-wars/print/manifests/response-card-deck-v1.json \
  --output dist/print/response-deck.assignments.json \
  --mode deck
```

### `migrate-assignments.mjs`
Convert legacy assignment JSON to schema v2.0.

```bash
npm run assignments:migrate -- --input ai-newspaper-tabloid_03_assignments.json --output dist/print/newspaper.assignments.v2.json
```

### `build-print-pdf.mjs`
Single command path for production output.

- Deck/Sheet cards flow: compile assignments, ingest, export PDF.
- Existing assignments flow: ingest assignments, export PDF.

```bash
npm run print:build -- \
  --cards /Users/julian/Code/nfl-agi-wars/cards_01/data/tito-implications-40.json \
  --manifest /Users/julian/Code/nfl-agi-wars/print/manifests/implication-card-sheet-v1.json \
  --template /Users/julian/Code/nfl-agi-wars/indt-templates/implication-sheet.indt \
  --output dist/print/implication-sheet.pdf \
  --mode sheet
```

### `validate-print-schemas.mjs`
Validate template manifests and/or assignment docs.

```bash
npm run print:validate -- --manifest /Users/julian/Code/nfl-agi-wars/print/manifests/response-card-sheet-v1.json
npm run print:validate -- --assignments dist/print/response-deck.assignments.json
```

### `extract-full-resolution-images.mjs`
Copy full-resolution linked assets referenced by a structured InDesign extraction JSON.

```bash
npm run images:fullres -- path/to/issue_extracted_structured.json
npm run images:fullres -- path/to/issue_extracted_structured_with_thumbs.json
```

Default output:

- A sibling `full-resolution/` folder next to the structured JSON.
- This is intentionally adjacent to `thumbnails/` when thumbnails already exist.

Use `--help` for options and `--output <dir>` to override the destination.

## InDesign JSX Scripts

### `ingest-assignments.jsx`
Canonical ingest script.

- Supports assignment schema `2.0`.
- Adapts legacy `pages[].assignments` format.
- Uses strict named-slot matching by default.
- Handles text, style application, local images, and URL images.

### `export-layout-map.jsx`
Reverse workflow map exporter. Useful for slot planning and assignment authoring.

### `export-pdf.jsx`
Exports active document to PDF. Accepts output path and preset arguments.

## Legacy Prototype Assets

The archived HTML/Vivliostyle prototype remains available via npm scripts prefixed with `legacy:*`.

Those scripts are retained for reference only and are not part of production.

## Legacy Scripts

`build-newspaper.jsx`, `build-image-test.jsx`, and `build-simple-test.jsx` are retained as legacy references and are not the canonical build path.
