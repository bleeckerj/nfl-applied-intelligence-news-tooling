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
