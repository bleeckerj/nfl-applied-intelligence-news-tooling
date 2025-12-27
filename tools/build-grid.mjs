import fs from "node:fs";
import path from "node:path";
import nunjucks from "nunjucks";

const root = process.cwd();
const dataPath = path.join(root, "content/issue-grid.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

nunjucks.configure(path.join(root, "templates"), { autoescape: true });

const html = nunjucks.render("grid_issue.njk", data);

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/grid.html"), html, "utf8");

const distStyles = path.join(root, "dist/styles");
fs.mkdirSync(distStyles, { recursive: true });
fs.cpSync(path.join(root, "styles"), distStyles, { recursive: true });

console.log("Wrote dist/grid.html");
