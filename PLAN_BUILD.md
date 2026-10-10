## PLAN_TECHNICAL

### Scope
- Cards-first implementation in `nfl-news-tooling` while keeping newspaper assignment ingestion compatible.
- Canonical workflow: template map/export -> assignment compile/validate -> ingest -> PDF export.
- Support both output modes: deck PDF and imposed sheet PDF.

### Build Phases
1. Stabilize baseline scripts and make assignment workflow canonical.
2. Introduce versioned assignment format and template manifest format.
3. Add legacy assignment adapter for backward compatibility.
4. Add card normalization and assignment compilation.
5. Add one command path with mode switch for deck/sheet output.
6. Enforce strict named slots and deterministic matching.
7. Add regression tests for validation, adapters, and card compilation.

### Core Interfaces
- Assignment document (`schema_version: "2.0"`): explicit `artifact_type`, `template_id`, `output_mode`, `pages[].slots[]`.
- Template manifest (`schema_version: "1.0"`): slot definitions and mapping rules.
- Card compiler: supports heterogeneous card JSON (`response`, `implication`) and optional `back` payloads.

### Compatibility
- Existing newspaper assignment files are adapted at runtime and can still be ingested.
- Existing newspaper scripts remain available; `build-newspaper.jsx` is explicitly legacy/non-canonical.

### Acceptance
- `bundle:indesign` runs successfully in ESM mode.
- Deck and sheet assignment compilation works.
- InDesign ingest accepts versioned assignments and legacy assignments.
- Image references (local paths and URLs) are validated and passed through pipeline.

## PLAN_PLAIN_LANGUAGE

### What this project now does
- Uses one clean system to fill InDesign templates from JSON data.
- Works for cards and newspapers.
- Makes both of your needed outputs:
  - Deck PDF (for print service).
  - Imposed sheet PDF (multiple cards arranged on each sheet).

### How it works in simple terms
1. Define or export template slots from InDesign.
2. Build assignment JSON in a consistent format.
3. Fill named frames in InDesign from that assignment JSON.
4. Export finished PDF.

### Why this helps
- Fewer disconnected scripts.
- Cleaner code and easier maintenance.
- Old newspaper files still work through a compatibility adapter.

### Images and card backs
- Images remain first-class data fields.
- JSON can hold local image paths or image URLs.
- Optional back-side fields are included so recto/verso can be expanded without redesigning the pipeline.

### Definition of done
- One stable and documented flow.
- Both deck and sheet outputs supported.
- Compatibility preserved for existing newspaper assignment files.
