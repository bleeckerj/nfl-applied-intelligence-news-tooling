import fs from "node:fs";
import path from "node:path";
import https from "node:https";

const root = process.cwd();

function parseArgs(argv) {
  const result = {
    input: "content/issue-threaded.json",
    output: "dist/indesign-data.json",
    imageDir: "dist/images",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--input") {
      result.input = argv[++index];
    } else if (arg === "--output") {
      result.output = argv[++index];
    } else if (arg === "--image-dir") {
      result.imageDir = argv[++index];
    }
  }

  return result;
}

function downloadImage(url, destinationPath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destinationPath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}. HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(fileStream);
        fileStream.on("finish", () => {
          fileStream.close(resolve);
        });
      })
      .on("error", (error) => {
        fs.unlink(destinationPath, () => reject(error));
      });
  });
}

async function resolveImagePath(imageSource, imageDirPath) {
  if (!imageSource) return null;

  if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
    const imageFileName = path.basename(new URL(imageSource).pathname) || "downloaded-image.jpg";
    const localPath = path.join(imageDirPath, imageFileName);
    fs.mkdirSync(imageDirPath, { recursive: true });
    await downloadImage(imageSource, localPath);
    return localPath;
  }

  return path.resolve(root, imageSource);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(root, options.input);
  const outputPath = path.resolve(root, options.output);
  const imageDirPath = path.resolve(root, options.imageDir);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input JSON not found: ${inputPath}`);
  }

  const sourceData = JSON.parse(fs.readFileSync(inputPath, "utf8"));

  const pages = await Promise.all(
    (sourceData.pages || []).map(async (page) => {
      const leadImagePath = await resolveImagePath(page?.lead?.image, imageDirPath);
      return {
        type: page.type || "frontpage",
        masthead: page.masthead,
        lead: page.lead
          ? {
              headline: page.lead.headline,
              dek: page.lead.dek,
              byline: page.lead.byline,
              body: page.lead.body,
              image: leadImagePath,
            }
          : null,
        sidebar: page.sidebar
          ? {
              title: page.sidebar.headline || page.sidebar.title,
              items: page.sidebar.items || [],
            }
          : null,
      };
    })
  );

  const bundled = {
    issue: sourceData.issue,
    date: sourceData.date,
    pages,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(bundled, null, 2)}\n`, "utf8");

  console.log(`Bundled InDesign data written to: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
