# Implementation Plan: Inline Content Inserts (Callouts & Media)

Legacy note: this plan targets the archived HTML/Vivliostyle prototype path. It is not part of the current production workflow.

## Objective
Enable authors to insert rich, independent content blocks (callouts, images, sidebars) directly within the flow of a story's body text. These blocks can contain content unrelated to the immediate surrounding text (e.g., "Tip Line" info, Author Bio) and should support configurable layout options (column spanning, floating).

## 1. Authoring Schema (JSON)

We will use custom HTML-like tags within the `body` string of the `issue.json` file. This allows the content to be placed precisely where it should appear in the flow.

### The `<callout>` Tag
Used for text-based inserts.

**Syntax:**
```html
<callout type="style-name" width="columns" float="position">
  Content goes here...
</callout>
```

**Attributes:**
*   `type`: (Optional) Maps to a CSS class modifier (e.g., `tip`, `bio`, `quote`). Default is generic.
*   `width`: (Optional)
    *   `1` (Default): Fits within the current column.
    *   `all`: Spans all columns of the story container.
*   `float`: (Optional) `top` or `bottom`. Defaults to natural flow or top of column depending on CSS.

**Example:**
```json
"body": "The investigation is ongoing. <callout type='tip' width='1'>Have a tip? Call 555-0199.</callout> However, police are hopeful..."
```

### The `<media>` Tag
Used for images or figures.

**Syntax:**
```html
<media src="path/to/image.jpg" caption="Optional caption" width="columns"></media>
```

**Attributes:**
*   `src`: Path to the image file.
*   `caption`: (Optional) Text to display below the image.
*   `width`: `1` or `all`.

## 2. Build Process (Transformation)

We will modify `tools/build-html.mjs` to include a pre-processing step that transforms these tags into semantic HTML before Nunjucks rendering.

**Transformation Logic:**
1.  **Regex Parsing**: Identify `<callout>` and `<media>` tags.
2.  **HTML Generation**:
    *   `<callout>` &rarr; `<aside class="inline-insert callout ...">...</aside>`
    *   `<media>` &rarr; `<figure class="inline-insert media ..."><img ...><figcaption>...</figcaption></figure>`

**Generated HTML Structure:**
```html
<!-- Callout -->
<aside class="inline-insert callout callout--type-tip callout--width-1">
  <div class="callout__content">
    Have a tip? Call 555-0199.
  </div>
</aside>

<!-- Media -->
<figure class="inline-insert media media--width-all">
  <img src="path/to/image.jpg" alt="" />
  <figcaption>Optional caption</figcaption>
</figure>
```

## 3. CSS Strategy (`styles/newspaper.css`)

We will leverage CSS Paged Media properties to handle the layout within the multi-column story flow.

**Base Class:**
```css
.inline-insert {
  break-inside: avoid;
  margin-bottom: 4mm;
  box-sizing: border-box;
}
```

**Width Modifiers:**
*   `.callout--width-1`, `.media--width-1`:
    *   `width: 100%` (fills the column).
    *   `float: top` or `float: bottom` (optional, to snap to column edges).
*   `.callout--width-all`, `.media--width-all`:
    *   `column-span: all`;
    *   `margin: 6mm 0`;

**Styling Modifiers (Theming):**
*   `.callout--type-tip`: Bold borders, icon, sans-serif font.
*   `.callout--type-quote`: Large italic serif font, no borders.
*   `.callout--type-bio`: Small text, grey background.

## 4. Implementation Steps

1.  **Update `tools/build-html.mjs`**: Add the `processBodyText` function to transform tags.
2.  **Update `styles/newspaper.css`**: Add the CSS classes for layout and styling.
3.  **Test**: Add example tags to `content/issue.json` and verify the PDF output.
