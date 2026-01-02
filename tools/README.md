# InDesign Automation Tools

This folder contains scripts and tools for the "Headless Newsroom" workflow, allowing you to automate InDesign layout from structured data.

## CLI Tools (Run from Terminal)

### `run-id-script.mjs`
A utility to run InDesign scripts (`.jsx`) from your system terminal. It can also open a specific InDesign document before running the script.

**Usage:**
```bash
# Run a script on the currently open document
npm run indesign:run -- --script=tools/export-layout-map.jsx

# Open a file and then run a script
npm run indesign:run -- --file=templates/Newspaper_Template.indt --script=tools/make-flatplan.jsx
```

### `bundle-for-indesign.js`
Prepares your content for InDesign. It reads `issue.json`, resolves Markdown files, downloads remote images, and creates a single `dist/indesign-data.json` file that the InDesign scripts can read.

**Usage:**
```bash
npm run bundle:indesign
```

---

## InDesign Scripts (Run inside InDesign)

These scripts are written in ExtendScript (JSX) and are meant to be executed by Adobe InDesign. You can run them manually via the Scripts Panel or using the CLI tool above.

### `build-newspaper.jsx`
**The Main Builder.** Reads `dist/indesign-data.json` and builds a newspaper layout based on `templates/Newspaper_Template.indt`.
*   Creates pages.
*   Flows text into columns.
*   Places images.

### `export-layout-map.jsx`
**Reverse Workflow.** Exports the structure of the currently active InDesign document to a JSON file.
*   Captures page items, names, IDs, and styles.
*   Useful for creating a "map" of a template to know where content should go.

### `make-flatplan.jsx`
**Planning Tool.** Converts a copy of your document into a visual "Flatplan".
*   **Overwrites content** in text frames with their Name and Style (e.g., `TF_P1_1 (Headline)`).
*   Places placeholder images (via `fpoimg.com`) in graphic frames with their names.
*   **Warning:** Always run this on a COPY of your document.

### `build-image-test.jsx`
A simple test script to verify that images can be placed correctly from the data.

### `build-simple-test.jsx`
A "Hello World" for InDesign scripting to verify your setup is working.
