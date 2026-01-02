# InDesign Automation Workflow: "The Headless Newsroom"

This document outlines a proposed architecture for automating the layout of the "Near Future Times" using Adobe InDesign. This approach solves the limitations of CSS Paged Media (Vivliostyle) regarding complex text threading, precise layout control, and post-generation editing.

## The Concept

**"Workshop participants write text -> Automation does 90% of the work -> You tweak the final 10% in InDesign."**

This workflow separates content creation from layout production, using a "Bridge" script to prepare data for InDesign's scripting engine.

## Architecture

### 1. The Content Layer (The Newsroom)
*   **Format:** Markdown (`.md`) and JSON (`issue.json`).
*   **Role:** Workshop participants write stories in plain text. They do not need InDesign.
*   **Structure:** Same as the current project structure.

### 2. The Bridge (Node.js)
*   **Role:** Prepares raw content for InDesign.
*   **Input:** `issue.json` and `content/*.md`.
*   **Output:** `dist/indesign-data.json`.
*   **Tasks:**
    *   Resolves all Markdown files into plain text (or tagged text).
    *   Resolves relative image paths to absolute system paths (required by InDesign).
    *   Calculates estimated lengths (optional, for planning).

### 3. The Template (InDesign)
*   **File:** `templates/Newspaper_Template.indt`
*   **Contains:**
    *   **Paragraph Styles:** `Headline`, `Dek`, `Byline`, `Body Text`, `Brief Headline`, `Brief Body`.
    *   **Character Styles:** `Bold`, `Italic`.
    *   **Master Pages:** 5-column grid, folio headers, page numbers.
    *   **Object Styles:** `Sidebar Box`, `Photo Frame`.

### 4. The Automation Script (ExtendScript / JSX)
*   **File:** `tools/build-newspaper.jsx`
*   **Role:** Runs *inside* InDesign to build the document.
*   **Tasks:**
    *   Reads `indesign-data.json`.
    *   Creates a new document from the Template.
    *   Draws text frames on the grid.
    *   Flows text and threads frames (Column 1 -> Column 2).
    *   Places images.

---

## Implementation Details

### Step 1: The Data Structure (`indesign-data.json`)
The Node.js bridge should output a flat, easy-to-read JSON object for InDesign.

```json
{
  "issue": "Vol. 1 No. 1",
  "date": "2025-10-15",
  "pages": [
    {
      "type": "frontpage",
      "lead": {
        "headline": "City Opens Office of Speculative Works",
        "dek": "A new department prototypes policies...",
        "byline": "By J. Bleecker",
        "body": "The city announced a new Office... [Full Text]",
        "images": ["/Users/julian/Code/.../image1.jpg"]
      },
      "sidebar": {
        "title": "Briefs",
        "items": [
          { "headline": "Signals Report", "body": "..." },
          { "headline": "Lab Opens", "body": "..." }
        ]
      }
    }
  ]
}
```

### Step 2: The InDesign Script (`tools/build-newspaper.jsx`)
Save this file and run it via the InDesign Scripts Panel.

```javascript
// tools/build-newspaper.jsx

function main() {
    // 1. Load Data
    var dataFile = File.openDialog("Select indesign-data.json");
    if (!dataFile) return;
    dataFile.open("r");
    var data = eval("(" + dataFile.read() + ")"); // Parse JSON
    dataFile.close();

    // 2. Open Template
    // Update this path to your actual template location
    var templatePath = "/Users/julian/Code/nfl-futures-in-print/templates/Newspaper_Template.indt";
    var doc = app.open(File(templatePath));

    // 3. Layout Logic (Example for Front Page)
    var page = doc.pages[0];
    var margin = 15; // mm
    var colWidth = 45; // mm (Example 5-col grid)
    var gutter = 4; // mm
    
    // --- Place Lead Story ---
    var storyData = data.pages[0].lead;
    
    // Headline
    var headFrame = page.textFrames.add();
    // GeometricBounds: [Top, Left, Bottom, Right]
    headFrame.geometricBounds = [30, margin, 50, margin + (colWidth*3) + (gutter*2)]; 
    headFrame.contents = storyData.headline;
    headFrame.parentStory.appliedParagraphStyle = doc.paragraphStyles.item("Headline");

    // Body Text - Column 1
    var bodyFrame1 = page.textFrames.add();
    bodyFrame1.geometricBounds = [55, margin, 250, margin + colWidth];
    bodyFrame1.contents = storyData.body;
    bodyFrame1.parentStory.appliedParagraphStyle = doc.paragraphStyles.item("Body Text");

    // Body Text - Column 2 (Threaded)
    var bodyFrame2 = page.textFrames.add();
    bodyFrame2.geometricBounds = [55, margin + colWidth + gutter, 250, margin + (colWidth*2) + gutter];
    
    // LINK FRAMES
    bodyFrame1.nextTextFrame = bodyFrame2;

    // --- Place Sidebar ---
    var sidebarData = data.pages[0].sidebar;
    if (sidebarData) {
        var sidebarFrame = page.textFrames.add();
        sidebarFrame.geometricBounds = [55, margin + (colWidth*2) + (gutter*2), 200, margin + (colWidth*3) + (gutter*2)];
        sidebarFrame.fillColor = "Paper"; // Or a defined swatch
        sidebarFrame.contents = sidebarData.title.toUpperCase() + "\r";
        sidebarFrame.parentStory.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.item("Section Header");
        
        // Loop through briefs
        for (var i=0; i<sidebarData.items.length; i++) {
            sidebarFrame.contents += sidebarData.items[i].headline + "\r";
            // Apply style to the just-added paragraph (logic requires more robust range handling in production)
            sidebarFrame.contents += sidebarData.items[i].body + "\r\r";
        }
    }
    
    alert("Layout Complete! Time for manual tweaking.");
}

main();
```

## Workflow Summary

1.  **Setup:**
    *   Create `templates/Newspaper_Template.indt` in InDesign with all styles defined.
    *   Install `tools/build-newspaper.jsx` into your InDesign Scripts folder.

2.  **During Workshop:**
    *   Participants write stories in Markdown.
    *   Run `npm run bundle` (executes the Node.js bridge).
    *   This generates `dist/indesign-data.json`.

3.  **Production:**
    *   Open InDesign.
    *   Double-click `build-newspaper.jsx` in the Scripts panel.
    *   Select the generated JSON file.
    *   **Result:** A fully laid-out `.indd` file.
    *   **Final Step:** Manually adjust image crops, fix bad line breaks, and export PDF.

## Handling Complexity: The Full Issue Architecture

To handle a complete newspaper with varied sections (Classifieds, Opinion, Feature Spreads), we use a **"Dispatcher Pattern"** in the script.

### 1. The Expanded Data Structure
Instead of just "pages", we define **Sections** and **Layout Types**.

```json
{
  "issue_meta": { ... },
  "sequence": [
    {
      "type": "frontpage",
      "layout_id": "fp_v1",
      "lead_story": { ... },
      "sidebar": { ... }
    },
    {
      "type": "spread",
      "layout_id": "feature_3col",
      "title": "The Big Story",
      "stories": [ ... ]
    },
    {
      "type": "classifieds",
      "layout_id": "grid_6col",
      "items": [
        { "category": "Jobs", "text": "..." },
        { "category": "For Sale", "text": "..." }
      ]
    }
  ]
}
```

### 2. The Script Dispatcher
The main loop of the script looks at the `type` of each page and hands it off to a specialized function.

```javascript
// tools/build-newspaper.jsx (Expanded)

function main() {
    // ... load data and template ...
    
    var sequence = data.sequence;
    
    // Loop through the issue sequence
    for (var i = 0; i < sequence.length; i++) {
        var pageData = sequence[i];
        
        // Create a new page (or spread)
        var page = doc.pages.add();
        
        // THE DISPATCHER
        switch (pageData.type) {
            case "frontpage":
                layoutFrontPage(page, pageData);
                break;
            case "spread":
                layoutFeatureSpread(page, pageData);
                break;
            case "classifieds":
                layoutClassifieds(page, pageData);
                break;
            default:
                layoutGeneric(page, pageData);
        }
    }
}

// --- Specialized Layout Functions ---

function layoutFrontPage(page, data) {
    // Logic for Masthead, Lead Story, Sidebar
    // Uses "Headline - Display" styles
}

function layoutClassifieds(page, data) {
    // Logic for 6-column grid
    // Loops through hundreds of small items
    // Uses "Classified Text" styles (6pt font)
    
    var colCount = 6;
    var colWidth = (page.bounds[3] - page.bounds[1] - (margin*2)) / colCount;
    
    // Flow text column by column...
}
```

### 3. Style Mapping
In your InDesign Template, you organize styles into groups. The script maps JSON data to these specific styles.

*   **News Section:** Uses `Body Text`, `Headline Serif`.
*   **Sci-Fi Section:** Uses `Body Text Sans`, `Headline Futura`.
*   **Classifieds:** Uses `Classified Header`, `Classified Body`.

You can even pass style names in the JSON if you want granular control from the text file:
`{ "headline": "My Story", "style_override": "Headline - Impact" }`

### 4. "Snippets" (.idms) for Complex Modules
For very complex, repeated elements (like a specific "Scoreboard" box or a "Weather Widget"), you don't draw them with code.
1.  Design the element perfectly in InDesign.
2.  Export it as an **InDesign Snippet (.idms)**.
3.  The script simply **places** the snippet (`page.place(File("weather-widget.idms"))`) and then injects the new text into it.

This hybrid approach (Code for structure, Snippets for complex design) gives you the best of both worlds.

## Fixed vs. Dynamic: Where do I specify layout?

You have two choices for how to control where things go. You can mix and match these methods in the same document.

### Method A: The "Reserved Seat" (Fixed Layout)
*Best for: Weather widgets, Mastheads, "Letter from the Editor" spots that never move.*

1.  **In InDesign (The Template):** You use the **Type Tool (T)** to draw a **Text Frame** on Page 1, bottom-left. You name this frame `"WeatherBox"` in the Layers panel (Window > Layers).
2.  **In JSON (The Data):** You just provide the content.
    ```json
    { "weather": "High 75°F, Chance of Rain" }
    ```
3.  **In Script:** The script looks for the named Text Frame and fills it.
    ```javascript
    // Find the Text Frame named "WeatherBox" and fill it
    doc.pages[0].textFrames.item("WeatherBox").contents = data.weather;
    ```
*   **Plain English:** The container is already there waiting. The script just pours the coffee into the mug.

### Method B: The "Tetris" (Dynamic Layout)
*Best for: Stories, Feature Spreads, Crosswords that might move around.*

1.  **In InDesign:** The pages are mostly empty (just margins and columns).
2.  **In JSON:** You list the items in the order you want them to appear.
    ```json
    "sequence": [
      { "type": "story", "headline": "Big News..." },
      { "type": "widget", "name": "crossword" },
      { "type": "story", "headline": "Another Story..." }
    ]
    ```
3.  **In Script:** The script places items one after another.
    *   It places "Big News".
    *   It sees "Crossword", loads the `crossword.idms` snippet, and places it immediately after "Big News".
    *   It places "Another Story" after the crossword.
*   **Plain English:** The script builds the page on the fly, stacking blocks (stories and widgets) one after another.

### Summary
*   **If it's always in the same spot:** Draw it in the Template.
*   **If it flows with the news:** List it in the JSON.

## Styling: Fixed vs. Dynamic

You asked: *"Can I specify font-family, size, italics, etc., or must they be fixed?"*

You have three levels of control, ranging from "Rigid" to "Total Control".

### Level 1: Paragraph Styles (The "Right" Way)
*Best for: Consistency.*
You define a style named **"Headline"** in the InDesign Template. It is set to *Helvetica Bold, 30pt*.
*   **In Script:** `myParagraph.appliedParagraphStyle = doc.paragraphStyles.item("Headline");`
*   **Pros:** If you want to change the font later, you change it in one place (InDesign).
*   **Cons:** The script can't say "Make *this specific* headline blue" unless you have a "Headline Blue" style.

### Level 2: Script Overrides (Dynamic Control)
*Best for: Data-driven sizing (e.g., "The bigger the number, the bigger the font").*
The script can override any property of the text it just placed.
*   **In Script:**
    ```javascript
    var myText = textFrame.parentStory;
    myText.appliedParagraphStyle = doc.paragraphStyles.item("Headline");
    
    // Dynamic Override:
    if (data.importance > 10) {
        myText.pointSize = 50; // Make it huge
        myText.fillColor = "Red";
    }
    ```

### Level 3: Adobe Tagged Text (Rich Content)
*Best for: Bold, Italic, and Drop Caps inside the story body.*
If your JSON contains plain text like `"This is *bold*."`, InDesign won't know what to do.
Instead, we use **Adobe Tagged Text**. It's a markup language InDesign reads natively.

1.  **In JSON:** You pass a tagged string.
    ```json
    { "body": "<TAG:Version,SN,2><cTypeface:Bold>This is bold.<cTypeface:>" }
    ```
    *(Note: Our "Bridge" script can automatically convert Markdown `**bold**` to this tag format.)*

2.  **In Script:** You tell InDesign to interpret the tags.
    ```javascript
    textFrame.contents = "mapped_file.txt"; // Placing a tagged text file preserves formatting
    ```

### Summary of Approaches

*   **Font Family:** Use **Paragraph Style** (e.g., "Body Text").
*   **Font Size:** Use **Paragraph Style** (Default) or **Script Override** (Dynamic).
*   **Italics / Bold:** Use **Character Styles** (via Tagged Text or Markdown conversion).
*   **Drop Caps:** Use **Paragraph Style** (Drop Caps settings are built-in).
*   **Color:** Use **Paragraph Style** or **Script Override**.

**Recommendation:** Use **Paragraph Styles** for 95% of things. Use **Script Overrides** only when the data dictates a visual change (e.g., "If stock price is down, make text red"). Use **Tagged Text** for bold/italics within paragraphs.

You asked: *"What is 'it' materially speaking?"*

**Materially, a Snippet is a file on your hard drive.** It has the file extension `.idms` (InDesign Markup Snippet).

### How you create one:
1.  Open InDesign.
2.  Design your "Crossword Puzzle" perfectly. Draw the grid, add the "Across/Down" text boxes, style the headline.
3.  Select all those objects.
4.  **Drag and drop** them from the InDesign page onto your Desktop (or File > Export > InDesign Snippet).
5.  You now have a file named `crossword.idms`.

### What is inside it?
It contains the code (XML) that describes exactly how to redraw those objects. It remembers:
*   The exact size and position of the boxes relative to each other.
*   The fonts, colors, and strokes.
*   The content (e.g., the empty grid squares).

### How the Automation uses it:
When the script sees `{ "widget": "crossword" }` in your JSON:
1.  It looks for `crossword.idms` in your snippets folder.
2.  It tells InDesign: *"Place this file at these coordinates."*
3.  InDesign essentially "pastes" the contents of that file onto the page.

**Think of it like a Rubber Stamp.** You carve the stamp once (design the snippet). The automation robot picks up the stamp and presses it onto the paper whenever the instructions say "Stamp Crossword Here".

## Handling Images: "Find or Create"

You can target specific image frames by name, or let the script create them dynamically.

### 1. The "Reserved Seat" (Named Frames)
*Best for: Fixed layouts where you know exactly where the photo goes.*

1.  **In InDesign:** Draw a Rectangle Frame (F). Name it `"HERO_IMAGE"` in the Layers panel.
2.  **In JSON:** Map the target name to the source image.
    ```json
    "images": [
      { "target": "HERO_IMAGE", "src": "https://example.com/photo.jpg" }
    ]
    ```
3.  **In Script:**
    ```javascript
    var frame = page.rectangles.item("HERO_IMAGE");
    if (frame.isValid) {
        frame.place(File(imagePath));
        frame.fit(FitOptions.FILL_PROPORTIONALLY); // Covers the frame (like CSS object-fit: cover)
        frame.fit(FitOptions.CENTER_CONTENT);      // Centers the image
    }
    ```

### 2. The "Dynamic Fallback"
If the script *cannot* find a frame with that name, it can be programmed to:
1.  Create a new frame at a calculated position.
2.  Place the image.
3.  Push the text frames down to make room.

This allows a single script to handle both rigid templates and flexible, content-driven layouts.

## Advanced Architecture: Multi-Template Assembly

You asked: *"Can we cobble together a final document from several distinct templates?"*

**Yes.** This is the standard way to handle complex publications.

### The "Frankenstein" Method
Instead of one master template, you have a library of "Page Modules":
*   `templates/FrontPage_A.indt` (Big Hero Image)
*   `templates/FrontPage_B.indt` (Text Heavy)
*   `templates/Spread_Interview.indt`
*   `templates/BackPage_Ad.indt`

**The Script Logic:**
1.  **Create** a new, empty "Final Assembly" document.
2.  **Loop** through your JSON sequence.
3.  **Open** the specific template required for that page (e.g., `FrontPage_A`).
4.  **Duplicate** the pages from the Template into the Final Assembly.
    ```javascript
    templateDoc.pages[0].duplicate(LocationOptions.AT_END, finalAssemblyDoc);
    ```
5.  **Close** the template.
6.  **Fill** the content on the newly added page in the Final Assembly.

This allows you to mix and match layouts endlessly without writing complex drawing code.

## The Workshop Interface: "Hot Folders"

You asked: *"Can we build a simple interface for workshop participants?"*

**Yes.** Since you have one InDesign workstation, you can set up a **"Hot Folder"** workflow.

### The Architecture
1.  **The Web Interface (Node.js):**
    *   A simple local website running on the network.
    *   Participants paste their JSON or upload a Zip file.
    *   The server saves this as `job_001.json` into a folder named `INBOX`.

2.  **The Watcher (InDesign Script):**
    *   A script running inside InDesign (using `app.scheduleTask` or a simple loop).
    *   It watches the `INBOX` folder.
    *   **When a file appears:**
        1.  It runs the layout automation.
        2.  It exports a PDF to an `OUTBOX` folder.
        3.  It moves the JSON to `PROCESSED`.

3.  **The Feedback:**
    *   The Web Interface polls the `OUTBOX`.
    *   When `job_001.pdf` appears, it shows a "Download PDF" button to the participant.

This creates a "Magic Box" experience: They submit text, and 30 seconds later, a laid-out newspaper PDF appears.

## Handling Image Uploads in the Workshop

You noted: *"It may be necessary to send image data with the JSON."*

Since JSON is text-only, you have two main options for bundling images with the submission:

### Option A: The Zip File (Recommended)
The user uploads a single `.zip` file containing:
*   `issue.json`
*   `images/photo1.jpg`
*   `images/photo2.png`

**The Workflow:**
1.  Node.js server receives the Zip.
2.  Unzips it to a unique folder: `INBOX/job_123/`.
3.  InDesign script reads `INBOX/job_123/issue.json`.
4.  When the JSON references `"src": "images/photo1.jpg"`, the script resolves it relative to that folder.

### Option B: Base64 Embedding (Not Recommended for Print)
You *could* embed the image data directly in the JSON string:
`{ "image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..." }`

**Why avoid this?**
1.  **Performance:** JSON files become massive (hundreds of MBs) and slow to parse.
2.  **InDesign Compatibility:** InDesign cannot "place" a Base64 string. You would have to write a script to decode it back into a `.jpg` file on disk before placing it anyway.

**Verdict:** Stick to **Option A (Zip File)**. It keeps the data clean and the assets manageable.

## Reverse Workflow: Template Mapping & Flatplanning

We have added tools to support a "Reverse Workflow" where you design a template in InDesign first, export its structure, and use that to plan content.

### 1. Export Layout Map (`tools/export-layout-map.jsx`)
*   **Role:** Analyzes an open InDesign document and exports a JSON map of all pages and items.
*   **Usage:** Open your template/document in InDesign, run this script.
*   **Output:** A JSON file containing:
    *   Page dimensions and names.
    *   All page items (TextFrames, Rectangles).
    *   Item names, IDs, and geometric bounds.
    *   Assigned paragraph styles (for text frames).
    *   Current content (for reference).

### 2. Create Flatplan (`tools/make-flatplan.jsx`)
*   **Role:** Visualizes the "names" of your layout items directly on the page.
*   **Usage:** 
    1.  Open a **COPY** of your InDesign document (it overwrites content!).
    2.  Run this script.
*   **Action:**
    *   Iterates through all items.
    *   Assigns unique names (e.g., `TF_P1_1`) if they are unnamed.
    *   **Replaces the content** of text frames with their Name and Style (e.g., `TF_P1_1 (Headline)`).
    *   Adds label text frames on top of image frames.
*   **Benefit:** You can print this "Flatplan" and use it to assign stories to specific box names in your content planning.

