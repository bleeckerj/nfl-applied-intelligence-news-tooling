# Newspaper-from-the-Future Compiler (Vivliostyle + JSON → HTML/CSS → PDF)

A small “publishing compiler” you can use (and extend) to make **workshop-friendly newspapers**:
participants author **structured content** (JSON today; Markdown tomorrow), and a repeatable build
pipeline pours that content into **fixed page templates** to generate a **print-ready PDF**.

This repo is designed so GPT Codex (or any coding assistant) can ingest it quickly: it includes a
tangible end-to-end example, file structure, commands, and clear extension points.

---

## What this project is (in one sentence)

**A template-driven newspaper layout system where JSON + images compile into a PDF using HTML/CSS paged media rendered by Vivliostyle.**

---

## Why this approach

Traditional layout tools (InDesign/Affinity) are excellent, but can be hard to “platform-ize” for workshops.
HTML/CSS + a paged-media renderer gives you:

- A reproducible build (same inputs → same PDF)
- A clean “content model” (JSON schema)
- A way to build UI later (forms → JSON → build)
- A stepping stone from “hand layout” to “semi-automated layout”

---

## Goals & constraints

### Goals
- **Workshop-friendly**: minimal setup for participants, low cognitive load
- **Semi-automated layout**: fixed modules/sections; content pours into boxes
- **Good-enough print**: suitable for small newspaper printers (or digital distribution)
- **Extensible**: easy to add page templates, modules, and validation

### Constraints (what makes this easier)
- Start with **fixed modules** (a known page grid: masthead, lead story, briefs, etc.)
- Use **fit-to-box** rules (copy budgets) rather than infinite flowing editorial layout
- Treat PDF generation as a deterministic compile step

---

## High-level workflow

1. **Authors** write content as JSON (headline, dek, byline, body, captions).
2. A small build script renders JSON into HTML using a template engine.
3. Vivliostyle paginates and renders HTML/CSS into a PDF.

In other words:

```
content/issue.json + images/ → build-html → dist/index.html → vivliostyle build → dist/issue.pdf
```

---

## What a “user” sees (workshop UX options)

### Option A — UI-based (later)
- A simple web form (or Notion/Google Form) collects story fields + image upload(s)
- The platform exports JSON and triggers a build
- User downloads a PDF

### Option B — Repo-based (today)
- Participants edit `content/issue.json`
- Run `npm run build`
- Open `dist/issue.pdf`

Option B is easiest for v1 workshops: you can run builds for everyone, or they can run locally.

---

## Repository layout

```
newspaper-v1/
  content/
    issue.json             # structured content
  images/
    hero.jpg               # your images live here (example uses hero.jpg)
  templates/
    issue.njk              # Nunjucks template → HTML
  styles/
    newspaper.css          # print CSS (paged media + grid)
  tools/
    build-html.mjs         # JSON → HTML compile step
  dist/                    # generated outputs
  package.json
  README.md
```

---

## Requirements

- Node.js 18+ recommended
- npm
- Vivliostyle CLI
- (Optional) Ghostscript + Xpdf (for certain “press-ready” PDF/X workflows, see below)

---

## Install

From the repo root:

```bash
npm install
```

Install Vivliostyle CLI globally:

```bash
npm install -g @vivliostyle/cli
```

---

## Quick start (generate PDF)

1) Put an image at:

```
images/hero.jpg
```

2) Build:

```bash
npm run build
```

3) Open:

```
dist/issue.pdf
```

---

## Preview in browser (fast iteration)

```bash
npm run preview
```

This renders the paginated preview so you can adjust CSS/layout quickly.

---

## The tangible example (source code)

### `content/issue.json`

```json
{
  "title": "The Near Future Times",
  "issue": "Vol. 1 No. 1",
  "date": "2025-12-26",
  "pages": [
    {
      "id": "p1",
      "masthead": "The Near Future Times",
      "kicker": "Special Edition",
      "lead": {
        "headline": "City Announces New Department of Imagination",
        "dek": "A pilot program treats speculation as civic infrastructure.",
        "byline": "By J. Bleecker",
        "body": "Your lead story body text goes here. Keep it short for the demo. Add more paragraphs to see column flow.\n\nSecond paragraph…"
      },
      "briefs": [
        { "headline": "Lab Opens", "body": "A new lab will prototype policies as objects." },
        { "headline": "Signals Report", "body": "Weak signals become front-page artifacts." }
      ],
      "image": {
        "src": "images/hero.jpg",
        "caption": "A prototype from a plausible near future."
      }
    }
  ]
}
```

### `templates/issue.njk`

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>{{ title }} — {{ issue }}</title>
    <link rel="stylesheet" href="../styles/newspaper.css" />
  </head>

  <body>
    {% for page in pages %}
    <section class="page">
      <header class="masthead">
        <div class="masthead__name">{{ page.masthead }}</div>
        <div class="masthead__meta">
          <span>{{ issue }}</span>
          <span>{{ date }}</span>
          <span>{{ page.kicker }}</span>
        </div>
      </header>

      <article class="lead">
        <h1 class="lead__headline">{{ page.lead.headline }}</h1>
        <p class="lead__dek">{{ page.lead.dek }}</p>
        <p class="lead__byline">{{ page.lead.byline }}</p>

        <div class="lead__wrap">
          <figure class="lead__figure">
            <img src="../{{ page.image.src }}" alt="" />
            <figcaption>{{ page.image.caption }}</figcaption>
          </figure>

          <div class="lead__body">
            {% for para in page.lead.body.split('\n\n') %}
              <p>{{ para }}</p>
            {% endfor %}
          </div>
        </div>
      </article>

      <aside class="briefs">
        <h2 class="briefs__title">Briefs</h2>
        {% for b in page.briefs %}
          <div class="brief">
            <h3>{{ b.headline }}</h3>
            <p>{{ b.body }}</p>
          </div>
        {% endfor %}
      </aside>
    </section>
    {% endfor %}
  </body>
</html>
```

### `styles/newspaper.css`

This is intentionally small but “newspaper-ish”:
- defines a physical page size
- sets margins
- uses a 12-column grid for modules
- uses CSS multi-column for body copy

```css
/* Page size: adjust as needed for your printer. */
@page {
  /* Example: tabloid-ish (custom) */
  size: 289mm 380mm;
  margin: 15mm;
}

html, body {
  font-family: Georgia, serif;
  font-size: 10.5pt;
  line-height: 1.25;
}

.page {
  break-after: page; /* each .page becomes a PDF page */
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  column-gap: 4mm;
  row-gap: 4mm;
}

/* Masthead spans full width */
.masthead {
  grid-column: 1 / -1;
  border-bottom: 0.6pt solid #000;
  padding-bottom: 2mm;
}
.masthead__name {
  font-family: "Times New Roman", Times, serif;
  font-size: 34pt;
  font-weight: 700;
  line-height: 1;
}
.masthead__meta {
  display: flex;
  gap: 10mm;
  font-size: 9pt;
  margin-top: 1mm;
}

/* Lead story takes 8 columns, briefs take 4 */
.lead { grid-column: 1 / span 8; }
.briefs { grid-column: 9 / span 4; border-left: 0.6pt solid #000; padding-left: 3mm; }

.lead__headline { font-size: 26pt; line-height: 1.05; margin: 0 0 2mm 0; }
.lead__dek { font-size: 12pt; margin: 0 0 2mm 0; }
.lead__byline { font-size: 9pt; margin: 0 0 4mm 0; }

.lead__wrap {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3mm;
}

/* Make body feel like a newspaper with columns */
.lead__body {
  column-count: 2;
  column-gap: 5mm;
}

.lead__figure {
  break-inside: avoid;
  margin: 0;
}
.lead__figure img {
  width: 100%;
  height: auto;
  display: block;
}
.lead__figure figcaption {
  font-size: 8pt;
  margin-top: 1mm;
}

.briefs__title { font-size: 12pt; margin: 0 0 2mm 0; }
.brief { break-inside: avoid; margin-bottom: 3mm; }
.brief h3 { font-size: 11pt; margin: 0 0 1mm 0; }
.brief p { margin: 0; }
```

### `tools/build-html.mjs`

```js
import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";

const root = process.cwd();
const data = JSON.parse(fs.readFileSync(path.join(root, "content/issue.json"), "utf8"));

nunjucks.configure(path.join(root, "templates"), { autoescape: true });

const html = nunjucks.render("issue.njk", data);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/index.html"), html, "utf8");

console.log("Wrote dist/index.html");
```

### `package.json`

```json
{
  "name": "newspaper-v1",
  "type": "module",
  "private": true,
  "dependencies": {
    "nunjucks": "^3.2.4"
  },
  "scripts": {
    "build:html": "node tools/build-html.mjs",
    "build:pdf": "vivliostyle build dist/index.html -o dist/issue.pdf -s \"289mm,380mm\"",
    "build": "npm run build:html && npm run build:pdf",
    "preview": "npm run build:html && vivliostyle preview dist/index.html"
  }
}
```

---

## How to extend (the real project)

### 1) Add more pages
Add another element in `pages[]`:

```json
{
  "id": "p2",
  "masthead": "The Near Future Times",
  "kicker": "Continued",
  "lead": { ... },
  "briefs": [ ... ],
  "image": { ... }
}
```

Your template already loops pages. Each `.page` becomes one PDF page because of:

```css
.page { break-after: page; }
```

### 2) Add new modules (“sections”)
Add a new key in JSON (e.g., `opinion`, `ads`, `calendar`, `tvGuide`) and render it in the template:

```html
<aside class="opinion">
  <h2>{{ page.opinion.title }}</h2>
  ...
</aside>
```

Then give it a grid placement in CSS:

```css
.opinion { grid-column: 1 / span 4; }
```

### 3) Create multiple page templates
For example:
- `templates/frontpage.njk`
- `templates/insidepage.njk`

Your build script can select templates per page type:

```json
{ "id": "p1", "template": "frontpage", ... }
```

Then in Nunjucks:

```njk
{% include page.template + ".njk" %}
```

### 4) Add copy budgets (fit-to-box guardrails)
Workshops benefit from “copy budgets” so content fits:

- headline ≤ N characters
- dek ≤ N words
- body ≤ N words

Add a validator step in `tools/validate.mjs` (or Zod schema) that warns before rendering.

### 5) Add overflow detection (helpful)
Browsers don’t “fail” when text overflows; it just flows.
You can instrument your templates with a visible “overflow badge” by:
- setting fixed heights for certain modules
- adding `overflow: hidden;`
- optionally rendering a warning if word count > threshold

Workshops want gentle friction: “your story is too long; trim to fit.”

---

## Print considerations (pragmatic)

### Page size
The `@page size:` and Vivliostyle `-s "W,H"` should match.

- If your printer uses a standard size, set it there.
- If they provide a custom “digital tabloid” size, match it exactly.

### Margins
Printers often want safe margins. Don’t put critical text near the edge.

### Crop marks / bleed
Some printers want no marks; others want crop/bleed.
Vivliostyle can add crop marks via CLI flags.
Decide per print vendor.

### Color
Many small newspaper printers will handle conversion.
If you need true CMYK workflows later, you may eventually consider a more prepress-focused engine,
but this pipeline is a strong v1.

---

## Suggested “workshop mode” operating model

### Participants
- Write one story each in a structured format (JSON or a form UI that outputs JSON)
- Provide one image + caption

### Facilitator (you)
- Collect all story JSON (or merge into one issue JSON)
- Run `npm run build`
- Print or distribute PDF

This keeps the experience focused on imagination + storytelling, not layout software.

---

## Troubleshooting

### “vivliostyle: command not found”
You didn’t install globally or your PATH doesn’t include global npm bin.

```bash
npm install -g @vivliostyle/cli
```

### Images don’t appear
- Ensure the file exists at the path you reference.
- Verify the relative path from `dist/index.html` to `images/...` is correct.
  In this example we used `../images/hero.jpg` via template.

### Fonts look different on different machines
If you rely on system fonts, they vary.
For consistent output, bundle webfonts and reference them in CSS via `@font-face`.

### “press-ready” output
Vivliostyle supports a press-ready mode in some setups, but it may require additional tooling on your system.
Start simple; only add press-ready tooling once you know your printer demands it.

---

## Roadmap (practical)

- [ ] Add schema validation for `issue.json` (Zod)
- [ ] Add per-module copy budgets + warnings
- [ ] Add multi-page templates (front, inside, back)
- [ ] Add a small web UI that writes JSON
- [ ] Add image preprocessing (resize, enforce DPI, aspect ratios)
- [ ] Add “merge stories” script to assemble an issue from multiple files

---

## License

This repo is intended as a starter scaffold. Choose your license (MIT is typical).
Note: Vivliostyle itself is open-source; if you embed it into a hosted platform, understand its license obligations.

---

## One-liner build recap

```bash
npm install
npm install -g @vivliostyle/cli
npm run build
open dist/issue.pdf
```

---

## Contact / notes

If you’re using this as a workshop platform, you’ll likely want:
- repeatable fixed layouts (modules)
- validation and copy budgets
- a dead-simple “authoring” UI

Those are the three levers that turn “hard to describe” into “people can do this in 90 minutes.”
