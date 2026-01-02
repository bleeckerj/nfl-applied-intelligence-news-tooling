# InDesign Automation Pilot Plan

This guide outlines the steps to pilot the "Headless Newsroom" workflow using Adobe InDesign.

## 1. Prerequisites
*   **Adobe InDesign** (2020 or later recommended).
*   **Node.js** (already installed).
*   **The Project Workspace** (this folder).

## 2. Setup Instructions

### Step A: Create the InDesign Template
You need to create a base template file that defines your styles and grid.

1.  Open InDesign.
2.  Create a **New Document**:
    *   **Size:** Tabloid (11x17 in) or A3.
    *   **Margins:** 0.5 in (12.7mm).
    *   **Columns:** 5 (Gutter: 0.1667 in / 4mm).
    *   **Facing Pages:** Unchecked (for now).
3.  **Define Paragraph Styles** (Window > Styles > Paragraph Styles):
    *   Create a style named `Headline` (Large serif, e.g., 30pt).
    *   Create a style named `Body Text` (Serif, e.g., 10pt/12pt).
    *   Create a style named `Section Header` (Sans-serif, Bold, Uppercase).
    *   Create a style named `Brief Headline` (Sans-serif, Bold).
    *   Create a style named `Brief Body` (Sans-serif, Small).
4.  **Define Object Styles** (Window > Styles > Object Styles):
    *   Create a style named `Sidebar Box` (Fill: Light Gray, Stroke: None).
5.  **Save the file** as `Newspaper_Template.indt` inside the `templates/` folder of this project.

### Step B: Install the Automation Script
1.  Locate the `tools/build-newspaper.jsx` file in this project (I will create this for you).
2.  Open InDesign.
3.  Open the **Scripts Panel** (Window > Utilities > Scripts).
4.  Right-click on the **User** folder and select **Reveal in Finder/Explorer**.
5.  Create a shortcut/alias to `tools/build-newspaper.jsx` in that folder, or simply copy the file there.

## 3. The Workflow Pilot

### Step 1: Prepare Content
1.  Ensure `content/issue-threaded.json` exists (we will use this as our test source).
2.  Run the "Bridge" command to generate the InDesign data:
    ```bash
    npm run bundle:indesign
    ```
    *(This will create `dist/indesign-data.json`)*

### Step 2: Run Automation
1.  Open InDesign.
2.  In the **Scripts Panel**, double-click `build-newspaper.jsx`.
3.  When prompted, select the `dist/indesign-data.json` file.
4.  **Watch the magic happen.** The script will open your template and build the page.

### Step 3: Review & Tweak
1.  The script will leave you with an open `.indd` document.
2.  Check the text flow.
3.  Try editing a headline.
4.  Try resizing a text frame to see the text reflow.

---

## Next Steps
If this pilot is successful:
1.  We refine the `build-newspaper.jsx` script to handle more complex layouts (spreads, images).
2.  We expand the "Bridge" script to handle Markdown parsing and image path resolution.
