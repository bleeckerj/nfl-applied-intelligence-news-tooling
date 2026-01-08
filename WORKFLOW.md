# InDesign Automation Workflow

This project uses a "Reverse Workflow" to automate the creation of InDesign documents. Instead of writing content directly in InDesign, you export the layout structure to a JSON file, edit the content externally, and then "ingest" it back into the template.

## Prerequisites

1.  **Adobe InDesign** running.
2.  **Node.js** installed.
3.  Dependencies installed: `npm install`

## Workflow Steps

### 1. Prepare Your Template
Open your InDesign template (`.indt`) or document (`.indd`). Ensure your text frames and image boxes are set up how you want them.
- **Threading:** Link text frames for multi-page stories. The scripts handle threading automatically.
- **Naming:** You don't need to name every object manually; the scripts will assign IDs (e.g., `TF_P1_1`) automatically if they are missing.

### 2. Export Layout Map & Assignments
Run the export script to analyze the document and generate the content assignment file.

```bash
npm run indesign:run -- --file ./your-template.indt --script tools/export-layout-map.jsx
```

**Outputs:**
*   `[DocName]_layout-map.json`: A technical description of every item (dimensions, capacity).
*   `[DocName]_assignments.json`: The file you will edit. It contains "slots" for every text frame and image.

### 3. Generate Visual Flatplan (Optional)
To see which ID belongs to which box, generate a visual flatplan. This creates a PDF where every box is labeled with its ID (e.g., `TF_P1_1`).

**Warning:** This script modifies the open document. Use it on a copy or close without saving after the PDF is generated.

```bash
npm run indesign:run -- --file ./your-template.indt --script tools/make-flatplan.jsx
```

**Output:** `[DocName]_flatplan.pdf`

### 4. Create Content
Open the `[DocName]_assignments.json` file in your code editor.

*   **Text:** Replace `"CONTENT GOES HERE"` with your actual text.
    *   *Note:* For threaded stories, you only need to fill in the **first** frame. The script will flow the text automatically.
*   **Images:** Update the `src` field.
    *   **URL:** `"src": "https://example.com/image.jpg"` (Will be downloaded automatically).
    *   **Local:** `"src": "images/photo.jpg"` (Relative to the project root).

**Example:**
```json
"TF_P1_3": {
  "content": "The Future is Feline",
  "style": "Headline"
},
"Obj_P1_1": {
  "src": "https://placecats.com/300/200",
  "caption": "A cat"
}
```

### 5. Ingest Content
Once your JSON file is ready, run the ingest script to populate the InDesign template.

```bash
npm run indesign:run -- --file ./your-template.indt --script tools/ingest-assignments.jsx
```

The script will:
1.  Find the corresponding `_assignments.json` file.
2.  Download any remote images.
3.  Place images and fit them proportionally.
4.  Fill text frames and apply paragraph styles.

## Troubleshooting

*   **"Dingbats" / Encoding Issues:** The scripts force UTF-8 encoding. If you see strange characters, ensure your editor is saving the JSON as UTF-8.
*   **Missing Images:** Check the console output. If an image fails to download or isn't found locally, it will be skipped.
*   **Text Overflow:** The `_layout-map.json` provides `estimated_words` and `estimated_chars` to help you write to fit.

---

## Workflow: Content Inventory & Audit

While the workflow above handles **creation**, this workflow focuses on **extraction and auditing**. It allows you to pull content out of an existing InDesign file to verify text, check image paths, and audit reading order without needing to manually inspect every frame in InDesign.

### The Tools

1.  **`tools/extract-layout.sh`**: The main automation script.
    *   **Purpose:** Orchestrates the extraction process. It first runs an InDesign script to dump raw data, then runs a Node.js script to structure it.
    *   **Under the hood:**
        *   Calls `tools/extract-content.jsx`: Runs inside InDesign. Crawls every page and text frame, exporting geometry (`[y1, x1, y2, x2]`), content, and styling info to a raw JSON file.
        *   Calls `tools/structure-content.mjs`: Runs in Node.js. It takes the raw geometry and uses clustering algorithms to group disparate text frames into logical "Articles" or "Stories" based on their proximity and threading.

2.  **`tools/viewer/index.html`**: The Inventory Viewer.
    *   **Purpose:** A web-based tool to visualize the structured JSON. It provides a clean, "grey literature" list view of your newspaper content.
    *   **Features:** Sorting (Reading Order vs. ID), Filtering (Images vs. Text), and one-click copying of content paths.

### Step-by-Step Guide

#### 1. Extract Content
Run the extraction shell script on your InDesign document.

```bash
./tools/extract-layout.sh "path/to/your/issue.indd"
```

**What happens:**
*   InDesign opens (in the background).
*   A raw extraction file is created: `[filename]_extracted.json`.
*   A final structured file is created: `[filename]_extracted_structured.json`.

#### 2. Open the Viewer
Launch the local web viewer.

```bash
./tools/open-viewer.sh
```

This will open your default browser to the viewer page.

#### 3. Load & Audit
1.  Click **"Choose File"** in the viewer.
2.  Select the `_structured.json` file generated in Step 1.
3.  Use the controls to audit your content:
    *   **Sort Mode:**
        *   **Reading Order:** Groups items by columns and vertical position to mimic how a human reads the page.
        *   **Page & Vertical:** Strict top-to-bottom sorting.
        *   **ID:** Sort by creation time (useful for finding newest additions).
    *   **Filter:**
        *   **Images Only:** verify all image paths are correct.
        *   **Text Only:** Copy-paste headlines or body text for external editing/archiving.

