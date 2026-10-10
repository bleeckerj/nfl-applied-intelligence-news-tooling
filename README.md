# NFL Futures in Print

A structured-data publishing pipeline for named-slot templates, backend-specific ingest/export, and print-ready PDF output.

## Current Status

- Adobe InDesign is the current production backend.
- Assignment schema `2.0`, template manifests, and named-slot concepts are the stable interface.
- The older HTML/CSS + Vivliostyle path is retained as a legacy prototype only and is not the current workflow.

## Canonical Production Workflow

1. Start with a named-slot print template (`.indt`/`.indd` today).
2. Produce assignments in schema `2.0`.
3. Run the backend-specific ingest step.
4. Export a print-ready PDF.

This workflow currently supports:

- Newspaper templates, including backward compatibility for legacy assignment JSON.
- Card templates for deck PDFs and imposed sheet PDFs.

## Production Commands

| Command | Purpose |
| :--- | :--- |
| `npm run assignments:compile -- ...` | Compile card deck JSON + template manifest into assignments v2.0. |
| `npm run assignments:migrate -- ...` | Convert legacy assignments to v2.0. |
| `npm run print:build -- ...` | Compile assignments if needed, ingest into the current backend, and export PDF. |
| `npm run print:validate -- ...` | Validate manifests and assignment docs. |
| `npm run indesign:run -- ...` | Run JSX scripts in Adobe InDesign from the terminal. |
| `npm run images:fullres -- ...` | Copy full-resolution linked image assets from a structured InDesign extraction JSON. |
| `npm run bundle:indesign -- ...` | Bundle issue JSON for the older newspaper-to-InDesign bridge flow. |

## Legacy Prototype Commands

These commands are kept for archival/reference use only. They are not part of the production workflow.

| Command | Purpose |
| :--- | :--- |
| `npm run legacy:html:build` | Render the archived HTML prototype. |
| `npm run legacy:html:pdf` | Build the archived Vivliostyle PDF prototype. |
| `npm run legacy:html:preview` | Preview the archived Vivliostyle prototype. |
| `npm run legacy:grid:html` | Build the archived grid prototype HTML. |
| `npm run legacy:grid:pdf` | Build the archived grid prototype PDF. |

## Installation

```bash
npm install
```

Production automation currently assumes:

- Adobe InDesign
- macOS, because `tools/run-id-script.mjs` drives InDesign via AppleScript

Vivliostyle is no longer a normal install requirement. It remains an optional dependency for the archived prototype scripts only.

## Backend Strategy

- `indesign` is the current production backend.
- `quark` is the next tool family to evaluate if InDesign is replaced.
- Future backends should consume the existing assignment/template contract rather than redefine the repo around a tool-specific data model.

See:

- [tools/README.md](tools/README.md)
- [docs/decisions/0001-affinity-publisher-not-selected.md](docs/decisions/0001-affinity-publisher-not-selected.md)
- [docs/quarkxpress-feasibility-spike.md](docs/quarkxpress-feasibility-spike.md)

## Recovering Full-Resolution Images

If you have an InDesign extraction JSON and only see thumbnails in a sibling folder, use the structured JSON to copy the original linked assets at full resolution:

```bash
npm run images:fullres -- path/to/issue_extracted_structured.json
```

By default this writes to a sibling `full-resolution/` folder next to the JSON, which keeps it adjacent to the existing `thumbnails/` folder when present.

## Project Layout

```text
content/                  # source content and assembly artifacts
templates/                # print manifests plus archived HTML prototype templates
tools/                    # production automation scripts and archived prototype tools
styles/                   # archived HTML prototype CSS and fonts
dist/                     # generated outputs
tests/                    # validation and compiler tests
docs/                     # decisions and evaluation notes
```

## Repo Boundary

- `nfl-news-tooling` contains the tooling code, validators, ingest/export logic, and backend evaluation docs.
- `nfl-agi-wars` contains card data, card templates (`.indt`), and card manifests.
- Typical usage: run commands from `nfl-news-tooling`, but pass absolute paths to assets in `nfl-agi-wars`.

## Notes

- Strict named slots are the default for production ingest.
- `tools/build-newspaper.jsx` is legacy/non-canonical.
- Image paths and image URLs are both supported by the production ingest pipeline.
- Optional card-back payloads are supported for future recto/verso expansion.
- Affinity Publisher is not the current replacement target because it remains automation-insufficient for this repo's structured-data-first workflow.
