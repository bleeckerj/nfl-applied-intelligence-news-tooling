# Newspaper-from-the-Future Compiler

A template-driven newspaper layout system where structured content (JSON today, Markdown tomorrow) and images compile into a print-ready PDF via HTML/CSS paged media rendered by Vivliostyle.

## Objectives
- Make workshop-friendly newspapers with minimal setup and low cognitive load.
- Provide semi-automated layout using fixed modules and copy budgets.
- Generate repeatable, deterministic PDFs for print or digital distribution.
- Keep the system easy to extend with new templates, modules, and validation.

## Success conditions
- Given `content/issue.json` and images, running `npm run build` always produces the same `dist/issue.pdf`.
- Participants can edit content without touching layout code.
- Layout remains “good enough” for small printers (page size, margins, and safe areas respected).
- New pages or modules can be added by editing JSON, templates, and CSS with clear extension points.

## Context of use
- **Workshops:** participants author one story each; a facilitator compiles a full issue.
- **Prototyping:** test structured storytelling formats without layout software.
- **Repeatable publishing:** small-run newsletters or event zines with consistent layout rules.

## How it works
```
content/issue.json + images/ → build-html → dist/index.html → vivliostyle build → dist/issue.pdf
```

## Requirements
- Node.js 18+
- npm
- Vivliostyle CLI (`@vivliostyle/cli`)

## Quick start
1) Install dependencies:

```bash
npm install
npm install -g @vivliostyle/cli
```

2) Add an image at `images/hero.jpg` (or update the JSON to your file path).

3) Build the PDF:

```bash
npm run build
```

4) Open the output:

```
dist/issue.pdf
```

## Preview (fast iteration)
```bash
npm run preview
```

## Repository layout
```
content/
  issue.json         # structured content
images/
  hero.jpg           # images used by templates
styles/
  newspaper.css      # print CSS (paged media + grid)
templates/
  issue.njk          # Nunjucks template → HTML
tools/
  build-html.mjs     # JSON → HTML compile step
dist/               # generated output
```

## Extending the system
- **Add pages:** append another object to `pages[]` in `content/issue.json`.
- **Add modules:** add new JSON keys and render them in templates; place them via CSS grid.
- **Multiple templates:** select `page.template` and include the appropriate `.njk` file.
- **Copy budgets:** add a validation step (e.g., Zod) to keep content within box limits.
- **Overflow signals:** use fixed heights + `overflow: hidden;` to flag long copy.

## Troubleshooting
- **Vivliostyle not found:** run `npm install -g @vivliostyle/cli` and ensure your PATH includes global npm bin.
- **Images missing:** check relative paths from `dist/index.html` to `images/...`.
- **Font mismatch:** bundle webfonts via `@font-face` for consistent output.

## Strategy for implementation
1) **Baseline pipeline**
   - Keep `content/issue.json` as the single source of truth.
   - Ensure `tools/build-html.mjs` cleanly renders to `dist/index.html`.
   - Match `@page` size in CSS with Vivliostyle CLI `-s` settings.

2) **Validation + copy budgets**
   - Define a schema for JSON (Zod or JSON Schema).
   - Enforce max characters/words per field; warn before build.
   - Add a `tools/validate.mjs` step and wire into `npm run build`.

3) **Template modularity**
   - Split templates into `frontpage.njk`, `inside.njk`, `back.njk`.
   - Allow per-page template selection in JSON.
   - Extract reusable components (masthead, briefs, image block).

4) **Content ingestion options**
   - Add a “merge stories” script to assemble an issue from multiple JSON files.
   - Prototype a lightweight web form that exports valid JSON.

5) **Print readiness**
   - Add printer-specific sizing presets and safe-area guidance.
   - Evaluate crop marks/bleed settings with Vivliostyle flags.
   - Add image preprocessing (size, DPI, aspect ratio).

6) **Workshop ergonomics**
   - Provide sample templates and content stubs.
   - Document a facilitator flow for collecting content and building a full issue.

## License
Choose a license (MIT is common). Vivliostyle is open-source; review its license if embedding in a hosted product.
