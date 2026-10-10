# Legacy Prototype Archive

This document captures the archived HTML/CSS + Vivliostyle prototype path.

It is retained for reference only and is no longer the current repo story or production workflow.

## Current Status

- Production workflow: named-slot templates + assignment schema `2.0` + backend-specific ingest/export.
- Current production backend: Adobe InDesign.
- Archived prototype backend: HTML/CSS + Vivliostyle.

If you are looking for the current workflow, use:

- [README.md](README.md)
- [tools/README.md](tools/README.md)

## Archived Prototype Surface

These assets are retained for historical reference:

- `tools/build-html.mjs`
- `tools/build-grid.mjs`
- `tools/make-grid-pdf.mjs`
- `templates/issue.njk`
- `templates/layout.css.njk`
- `templates/grid_issue.njk`
- `templates/grid_pdf.njk`
- `styles/newspaper.css`
- `styles/grid.css`
- `preview.html`

Use the legacy-prefixed npm scripts if you need to inspect that path:

```bash
npm run legacy:html:build
npm run legacy:html:pdf
npm run legacy:html:preview
npm run legacy:grid:html
npm run legacy:grid:pdf
```

## Why It Was Archived

The prototype was useful for early exploration, but it is now explicitly non-canonical because the repo is optimizing for:

- structured-data ingest into visual templates
- deterministic placement into named slots
- production PDF export
- backend-specific automation that can evolve without changing the assignment contract

## Notes for Future Removal

- Keep the archived prototype code until a later hard-removal pass.
- Do not add new production features to the Vivliostyle path.
- If a future composition engine is evaluated, treat it as a new backend against the stable assignment/template interface rather than reviving this prototype as the default path.
