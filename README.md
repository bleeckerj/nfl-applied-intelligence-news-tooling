# NFL Futures in Print

A publishing pipeline for creating "artifacts from the future" — specifically based on InDesign automation and templates. This system separates content creation (Markdown/JSON) from layout production, allowing for both rapid digital prototyping and high-fidelity print workflows.

## 🚀 The Two Workflows

This repository supports two distinct rendering engines depending on your fidelity needs:

### 1. The Prototyping Engine (HTML/CSS)
*   **Powered by:** Vivliostyle (CSS Paged Media).
*   **Role:** Quick iteration, content testing, digital distribution.
*   **How it works:** `content/issue.json` → Nunjucks Templates → CSS Grid → PDF.
*   **Command:** `npm run preview` or `npm run build`

### 2. The Production Engine (InDesign Automation)
*   **Powered by:** Adobe InDesign ExtendScript ("The Headless Newsroom").
*   **Role:** Professional print production, robust text threading, CMYK color control.
*   **How it works:**
    *   **Reverse Workflow:** Analyze an InDesign template to create "assignments".
    *   **Content:** Write stories in Markdown/JSON to fit those assignments.
    *   **Ingest:** Scripts automatically pour text and images into the InDesign layout.
*   **Documentation:**
    *   [INDESIGN_AUTOMATION.md](INDESIGN_AUTOMATION.md): The architecture and concept.
    *   [WORKFLOW.md](WORKFLOW.md): Step-by-step guide for editors and designers.

## 🛠️ Tools & Utilities

### Content Inventory Viewer
A "grey literature" style reading tool to audit, sort, and review content, whether it comes from a raw issue file or extracted from an existing InDesign layout.

*   **Launch:** `./tools/open-viewer.sh`
*   **Features:**
    *   Sort by Reading Order, Page Geometry, or ID.
    *   Filter view to "Images Only" (path auditing) or "Text Only" (copy auditing).

### CLI Reference

| Command | Description |
| :--- | :--- |
| **Vivliostyle** | |
| `npm run preview` | Launch a browser preview of the HTML layout. |
| `npm run build` | Compile the HTML layout to PDF (`dist/issue.pdf`). |
| **InDesign** | *(Requires InDesign to be open)* |
| `npm run indesign:run -- --script <path>` | Run a JSX script inside InDesign. |
| `bundle:indesign` | Prepare local content for InDesign ingestion. |

## 📦 Installation

1.  **System Requirements:**
    *   Node.js 18+
    *   Adobe InDesign (for Production workflow)
    *   macOS (for InDesign scripting support via AppleScript)

2.  **Setup:**
    ```bash
    npm install
    npm install -g @vivliostyle/cli
    ```

## 🏗️ Project Structure

```
content/
  issue.json           # Structured content source
  ...                  # Markdown drafts
images/                # Local assets
templates/
  *.njk                # HTML templates (Vivliostyle)
  *.indt               # InDesign Templates
tools/
  viewer/              # Inventory Viewer Web App
  build-html.mjs       # JSON → HTML compiler
  ingest-assignments.jsx # InDesign Import Script
  export-layout-map.jsx  # InDesign Export Script
dist/                  # Build outputs
```

## Strategy for Implementation

1.  **Design Template:** Create a robust InDesign template (`.indt`) with named boxes or logical flow.
2.  **Map Layout:** Run `tools/export-layout-map.jsx` to generate a content budget.
3.  **Draft Content:** Write stories to fit the budget (Visual Flatplans help here).
4.  **Ingest & Refine:** Run `tools/ingest-assignments.jsx` to build the document, then manually fine-tune.

