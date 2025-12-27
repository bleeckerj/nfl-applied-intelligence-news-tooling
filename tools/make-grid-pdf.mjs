import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import nunjucks from "nunjucks";
import { generateGridSvg } from "./lib/grid.mjs";

const root = process.cwd();
const distDir = path.join(root, "dist");

// Simple argument parser
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace(/^--/, "").split("=");
  acc[key] = value ? (isNaN(value) ? value : parseFloat(value)) : true;
  return acc;
}, {});

// Configuration with defaults
const config = {
  cols: args.cols || 12,
  rows: args.rows || 12,
  width: args.width || "350mm",
  height: args.height || "500mm",
  margin: args.margin !== undefined ? args.margin : 15,
  marginTop: args.marginTop,
  marginBottom: args.marginBottom,
  marginLeft: args.marginLeft,
  marginRight: args.marginRight,
  gutter: args.gutter !== undefined ? args.gutter : 4,
};

const svgContent = generateGridSvg(config);

// Render template
nunjucks.configure(path.join(root, "templates"), { autoescape: false });
const html = nunjucks.render("grid_pdf.njk", {
  cols: config.cols,
  rows: config.rows,
  width: config.width,
  height: config.height,
  svgContent,
});

const filename = `grid-${config.cols}c-${config.gutter}g-${parseFloat(config.width)}x${parseFloat(config.height)}`;
const htmlPath = path.join(distDir, `${filename}.html`);
const pdfPath = path.join(distDir, `${filename}.pdf`);

fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(htmlPath, html, "utf8");

console.log(`Generated HTML: ${htmlPath}`);

try {
  console.log(`Building PDF: ${pdfPath}`);
  execSync(
    `npx vivliostyle build "${htmlPath}" -o "${pdfPath}" -s "${config.width},${config.height}"`,
    { stdio: "inherit", cwd: root }
  );
} catch (err) {
  console.error("Vivliostyle build failed. Ensure @vivliostyle/cli is installed.");
  process.exitCode = 1;
}
