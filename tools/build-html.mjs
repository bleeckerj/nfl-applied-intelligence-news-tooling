import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";
import { generateGridSvg } from "./lib/grid.mjs";

const root = process.cwd();

// Helper to process inline tags in body text
function processBodyText(text) {
  if (!text) return text;

  // Process <callout>
  text = text.replace(/<callout(?:\s+type=["']([^"']*)["'])?(?:\s+width=["']([^"']*)["'])?(?:\s+float=["']([^"']*)["'])?>([\s\S]*?)<\/callout>/g, (match, type, width, float, content) => {
    const typeClass = type ? ` callout--type-${type}` : "";
    const widthClass = width ? ` callout--width-${width}` : " callout--width-1";
    const floatClass = float ? ` callout--float-${float}` : "";
    return `<aside class="inline-insert callout${typeClass}${widthClass}${floatClass}"><div class="callout__content">${content}</div></aside>`;
  });

  // Process <media>
  text = text.replace(/<media\s+src=["']([^"']*)["'](?:\s+caption=["']([^"']*)["'])?(?:\s+width=["']([^"']*)["'])?\s*\/?>/g, (match, src, caption, width) => {
    const widthClass = width ? ` media--width-${width}` : " media--width-1";
    const captionHtml = caption ? `<figcaption>${caption}</figcaption>` : "";
    return `<figure class="inline-insert media${widthClass}"><img src="${src}" />${captionHtml}</figure>`;
  });

  return text;
}

// Recursive function to transform content
function transformContent(obj) {
  if (Array.isArray(obj)) {
    return obj.map(transformContent);
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj = {};
    for (const key in obj) {
      if (key === 'body' && typeof obj[key] === 'string') {
         newObj[key] = processBodyText(obj[key]);
      } else {
         newObj[key] = transformContent(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

// Get content file from args or default
const args = process.argv.slice(2);
const contentFileArg = args.find(arg => !arg.startsWith('--'));
const dataPath = contentFileArg ? path.resolve(root, contentFileArg) : path.join(root, "content/issue.json");

const inventoryPath = path.join(root, "templates/inventory.json");

const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

// Determine layout and theme
const layoutId = data.layout || "newspaper_tabloid";
const theme = data.theme || "newspaper";
const layout = inventory.layouts[layoutId];

if (!layout) {
  console.error(`Error: Layout "${layoutId}" not found in inventory.`);
  process.exit(1);
}

console.log(`Using layout: ${layout.name} (${layoutId})`);

// Parse layout for grid generator (remove 'mm' and convert to number)
const parseDim = (val) => (typeof val === "string" ? parseFloat(val) : val);
const gridConfig = {
  width: layout.width,
  height: layout.height,
  cols: layout.cols,
  rows: layout.rows,
  margin: parseDim(layout.margin),
  gutter: parseDim(layout.gutter),
  overlay: false,
  useOffset: true,
};

// Inject grid SVG if debug flag is present
const debugGrid = process.argv.includes("--debug-grid");
if (debugGrid) {
  // Disable offset for background image usage
  gridConfig.useOffset = false;
  const gridSvg = generateGridSvg(gridConfig);
  // Ensure dist exists before writing grid.svg (it is created later, so we need to do it now or move this)
  fs.mkdirSync(path.join(root, "dist"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist/grid.svg"), gridSvg, "utf8");
}

nunjucks.configure(path.join(root, "templates"), { autoescape: true });

// Render HTML
// Pass theme to template context
const processedData = transformContent(data);
const context = { ...processedData, theme };
const html = nunjucks.render("issue.njk", context);

// Render Layout CSS
const css = nunjucks.render("layout.css.njk", { layout, debugGrid });

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/index.html"), html, "utf8");

const distStyles = path.join(root, "dist/styles");
const distImages = path.join(root, "dist/images");
fs.mkdirSync(distStyles, { recursive: true });
fs.mkdirSync(distImages, { recursive: true });

fs.writeFileSync(path.join(distStyles, "layout.css"), css, "utf8");
fs.cpSync(path.join(root, "styles"), distStyles, { recursive: true });
if (fs.existsSync(path.join(root, "images"))) {
  fs.cpSync(path.join(root, "images"), distImages, { recursive: true });
}

const previewPath = path.join(root, "preview.html");
const previewHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Print Preview</title>
    <style>
      :root { color-scheme: light; }
      html, body { margin: 0; padding: 0; background: #f0f0f0; }
      body { display: grid; place-items: center; min-height: 100vh; }
      .frame {
        width: ${layout.width};
        height: ${layout.height};
        border: 1px solid #999;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15);
        background: #fff;
      }
      .note {
        font-family: Arial, sans-serif;
        font-size: 12px;
        color: #444;
        margin: 12px 0 0;
        text-align: center;
      }
    </style>
  </head>
  <body>
    <div>
      <iframe class="frame" src="dist/index.html"></iframe>
      <div class="note">Fixed-size preview (${layout.width} x ${layout.height})</div>
    </div>
  </body>
</html>`;

fs.writeFileSync(previewPath, previewHtml, "utf8");

console.log("Wrote dist/index.html and dist/styles/layout.css");
