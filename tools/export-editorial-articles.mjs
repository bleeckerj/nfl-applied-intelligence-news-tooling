import fs from "fs";
import path from "path";

function parseArgs(argv) {
  const args = {
    format: "json",
    output: "dist/nfl-editorial-import.json",
    minChars: 200,
    minWords: 80,
    minSentences: 3,
    section: "features",
    issue: 1,
    rubric: "Essay",
    defaultAuthor: "Monocle Editorial",
    coverImageUrl: "https://placehold.co/1200x900",
    heroImageUrl: "https://placehold.co/1600x900",
    includeEmpty: false,
    overwrite: false,
    dryRun: false,
    source: null,
    apiUrl: null,
    apiToken: null,
    publishDir: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--input") {
      args.input = next;
      i += 1;
      continue;
    }
    if (arg === "--output") {
      args.output = next;
      i += 1;
      continue;
    }
    if (arg === "--format") {
      args.format = next;
      i += 1;
      continue;
    }
    if (arg === "--min-chars") {
      args.minChars = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--min-words") {
      args.minWords = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--min-sentences") {
      args.minSentences = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--source") {
      args.source = next;
      i += 1;
      continue;
    }
    if (arg === "--section") {
      args.section = next;
      i += 1;
      continue;
    }
    if (arg === "--issue") {
      args.issue = Number(next);
      i += 1;
      continue;
    }
    if (arg === "--rubric") {
      args.rubric = next;
      i += 1;
      continue;
    }
    if (arg === "--default-author") {
      args.defaultAuthor = next;
      i += 1;
      continue;
    }
    if (arg === "--cover-image-url") {
      args.coverImageUrl = next;
      i += 1;
      continue;
    }
    if (arg === "--hero-image-url") {
      args.heroImageUrl = next;
      i += 1;
      continue;
    }
    if (arg === "--publish-dir") {
      args.publishDir = next;
      i += 1;
      continue;
    }
    if (arg === "--api-url") {
      args.apiUrl = next;
      i += 1;
      continue;
    }
    if (arg === "--api-token") {
      args.apiToken = next;
      i += 1;
      continue;
    }
    if (arg === "--include-empty") {
      args.includeEmpty = true;
      continue;
    }
    if (arg === "--overwrite") {
      args.overwrite = true;
      continue;
    }
    if (arg === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
  }

  return args;
}

function usage() {
  console.log(
    [
      "Usage:",
      "  node tools/export-editorial-articles.mjs --input <extracted.json> [options]",
      "",
      "Options:",
      "  --output <path>       Output path (default: dist/nfl-editorial-import.json)",
      "  --format <json|ndjson> Output format (default: json)",
      "  --min-chars <n>       Minimum body length to keep (default: 200)",
      "  --min-words <n>       Minimum words to keep (default: 80)",
      "  --min-sentences <n>   Minimum sentence count to keep (default: 3)",
      "  --include-empty       Keep records with empty body",
      "  --source <name>       Source label for payload metadata",
      "  --publish-dir <path>  Write MDX files to editorial content directory",
      "  --section <name>      Editorial section (default: features)",
      "  --issue <n>           Issue number (default: 1)",
      "  --rubric <label>      Rubric/frontmatter label (default: Essay)",
      "  --default-author <n>  Fallback author if byline missing",
      "  --cover-image-url <u> Frontmatter coverImage.url value",
      "  --hero-image-url <u>  Frontmatter hero.url value",
      "  --overwrite           Overwrite existing MDX files",
      "  --dry-run             Print actions without writing files",
      "  --api-url <url>       POST each article to this endpoint",
      "  --api-token <token>   Bearer token for API auth",
    ].join("\n"),
  );
}

function normalizeText(text) {
  if (!text) return "";
  return String(text)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function slugify(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractBylineText(content) {
  const text = normalizeText(content);
  if (!text) return "";
  if (/^by\s+/i.test(text)) return text.replace(/^by\s+/i, "").trim();
  if (text.startsWith("/")) return text.slice(1).trim();
  return "";
}

function deriveTitle(fullText, fallbackId) {
  const cleaned = normalizeText(fullText);
  if (!cleaned) return `Story ${fallbackId}`;
  const firstLine = cleaned.split("\n")[0].trim();
  if (firstLine.length > 15 && firstLine.length < 140) return firstLine;
  const words = cleaned.split(/\s+/).slice(0, 12).join(" ");
  return words.length > 0 ? words : `Story ${fallbackId}`;
}

function countWords(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
}

function countSentences(text) {
  const cleaned = normalizeText(text);
  if (!cleaned) return 0;
  const matches = cleaned.match(/[.!?](?:\s|$)/g);
  return matches ? matches.length : 0;
}

function isLikelyNonStory(text) {
  const cleaned = normalizeText(text).toLowerCase();
  if (!cleaned) return true;
  if (/^continued on page/.test(cleaned)) return true;
  if (/^fpo[:\s]/.test(cleaned)) return true;
  if (/^(project description|table of contents|masthead)\b/.test(cleaned)) return true;
  return false;
}

function rankTextCandidate(content, style, forByline = false) {
  const cleaned = normalizeText(content);
  if (!cleaned) return -1;
  if (cleaned.length > 180) return -1;
  if (/continued on page/i.test(cleaned)) return -1;

  const s = String(style || "").toLowerCase();
  let score = 0;

  if (forByline) {
    if (/byline|author/.test(s)) score += 10;
    if (/^by\s+/i.test(cleaned) || cleaned.startsWith("/")) score += 8;
    if (cleaned.length < 60) score += 2;
    return score;
  }

  if (/headline|headling|title|deck|hed/.test(s)) score += 10;
  if (cleaned.length > 25 && cleaned.length < 120) score += 3;
  if (!/\n/.test(cleaned)) score += 2;
  return score;
}

function extractFromRaw(data) {
  const byStory = new Map();

  for (const page of data.pages || []) {
    for (const item of page.items || []) {
      if (item.type !== "TextFrame") continue;
      if (!item.storyId) continue;

      const key = String(item.storyId);
      const existing = byStory.get(key) || {
        id: key,
        fullText: "",
        titleCandidates: [],
        bylineCandidates: [],
      };

      const text = normalizeText(item.content);
      const style = item.firstParagraphStyle || item.paragraphStyle || "";

      if (item.isStoryStart && item.storyFullText) {
        const fullText = normalizeText(item.storyFullText);
        if (fullText.length > existing.fullText.length) {
          existing.fullText = fullText;
        }
      }

      const titleScore = rankTextCandidate(text, style, false);
      if (titleScore >= 0) {
        existing.titleCandidates.push({ text, score: titleScore });
      }

      const bylineScore = rankTextCandidate(text, style, true);
      if (bylineScore >= 0) {
        existing.bylineCandidates.push({ text, score: bylineScore });
      }

      byStory.set(key, existing);
    }
  }

  return [...byStory.values()].map((record) => {
    const title = record.titleCandidates.sort((a, b) => b.score - a.score)[0]?.text || deriveTitle(record.fullText, record.id);
    const bylineRaw = record.bylineCandidates.sort((a, b) => b.score - a.score)[0]?.text || "";
    return {
      id: record.id,
      title: normalizeText(title),
      byline: extractBylineText(bylineRaw),
      body: record.fullText,
    };
  });
}

function extractFromStructured(data) {
  return (data.articles || []).map((article, idx) => {
    const body = normalizeText(article.full_text || "");
    const components = Array.isArray(article.components) ? article.components : [];

    const titleCandidate = components.find((c) => {
      const t = normalizeText(c.content);
      return /headline|title/i.test(String(c.type || "")) && t.length > 10 && t.length < 180;
    });

    const bylineCandidate = components.find((c) => {
      const t = normalizeText(c.content);
      return /byline|author/i.test(String(c.type || "")) || /^by\s+/i.test(t) || t.startsWith("/");
    });

    return {
      id: String(article.id ?? idx + 1),
      title: normalizeText(titleCandidate?.content || deriveTitle(body, article.id ?? idx + 1)),
      byline: extractBylineText(bylineCandidate?.content || ""),
      body,
    };
  });
}

function buildPayload(records, sourceName) {
  return records.map((record) => {
    const excerpt = record.body.slice(0, 280);
    const slugBase = slugify(record.title) || `story-${record.id}`;
    return {
      externalId: `${sourceName}:${record.id}`,
      source: sourceName,
      sourceStoryId: record.id,
      title: record.title,
      slug: slugBase,
      byline: record.byline,
      excerpt,
      body: record.body,
    };
  });
}

function escapeYamlString(value) {
  return JSON.stringify(String(value ?? ""));
}

function firstSentence(text, maxLen = 240) {
  const cleaned = normalizeText(text);
  if (!cleaned) return "";
  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/);
  const sentence = match ? match[1] : cleaned.slice(0, maxLen);
  return sentence.length > maxLen ? `${sentence.slice(0, maxLen - 1)}…` : sentence;
}

function bodyToMdxParagraphs(body) {
  const cleaned = normalizeText(body);
  if (!cleaned) return "";
  return cleaned
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => p.replace(/\n+/g, " "))
    .join("\n\n");
}

function uniqueSlug(baseSlug, seen) {
  if (!seen.has(baseSlug)) {
    seen.set(baseSlug, 1);
    return baseSlug;
  }
  const count = seen.get(baseSlug) + 1;
  seen.set(baseSlug, count);
  return `${baseSlug}-${count}`;
}

function writeEditorialMdx(payload, args) {
  const targetDir = path.join(args.publishDir, args.section, "issue", String(args.issue));
  const written = [];
  const skipped = [];
  const slugCounts = new Map();
  const today = new Date().toISOString().slice(0, 10);

  if (!args.dryRun) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  for (const article of payload) {
    const baseSlug = slugify(article.slug || article.title) || `story-${article.sourceStoryId}`;
    const slug = uniqueSlug(baseSlug, slugCounts);
    const filePath = path.join(targetDir, `${slug}.mdx`);

    if (!args.overwrite && fs.existsSync(filePath)) {
      skipped.push(filePath);
      continue;
    }

    const author = article.byline || args.defaultAuthor;
    const description = firstSentence(article.body, 260);
    const mdx = [
      "---",
      `identifier: ${escapeYamlString(slug)}`,
      `section: ${escapeYamlString(args.section)}`,
      `issue: ${Number(args.issue)}`,
      `rubric: ${escapeYamlString(args.rubric)}`,
      `title: ${escapeYamlString(article.title)}`,
      `author: ${escapeYamlString(author)}`,
      `pubDate: ${escapeYamlString(today)}`,
      `date: ${escapeYamlString(today)}`,
      `description: ${escapeYamlString(description)}`,
      `tags: [${escapeYamlString("newspaper-import")}, ${escapeYamlString(article.source)}]`,
      "coverImage:",
      `  url: ${escapeYamlString(args.coverImageUrl)}`,
      `  altText: ${escapeYamlString(`Cover image placeholder for ${article.title}`)}`,
      "hero:",
      `  url: ${escapeYamlString(args.heroImageUrl)}`,
      `  altText: ${escapeYamlString(`Hero image placeholder for ${article.title}`)}`,
      `remarks: ${escapeYamlString(`Imported from ${article.source} story ${article.sourceStoryId}.`)}`,
      "---",
      "",
      bodyToMdxParagraphs(article.body),
      "",
    ].join("\n");

    if (!args.dryRun) {
      fs.writeFileSync(filePath, mdx);
    }
    written.push(filePath);
  }

  return { written, skipped, targetDir };
}

async function postArticles(apiUrl, apiToken, payload) {
  let success = 0;
  let failed = 0;

  for (const article of payload) {
    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(apiToken ? { authorization: `Bearer ${apiToken}` } : {}),
        },
        body: JSON.stringify(article),
      });

      if (!res.ok) {
        failed += 1;
        const body = await res.text();
        console.warn(`POST failed for ${article.externalId}: ${res.status} ${body}`);
        continue;
      }
      success += 1;
    } catch (error) {
      failed += 1;
      console.warn(`POST error for ${article.externalId}: ${error.message}`);
    }
  }

  return { success, failed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    usage();
    process.exit(args.help ? 0 : 1);
  }
  if (!["json", "ndjson"].includes(args.format)) {
    console.error(`Invalid --format "${args.format}". Use json or ndjson.`);
    process.exit(1);
  }
  if (args.publishDir && (!args.section || !Number.isFinite(Number(args.issue)))) {
    console.error("When using --publish-dir, provide valid --section and numeric --issue.");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(args.input, "utf8"));
  const sourceName = args.source || path.basename(args.input, path.extname(args.input));

  let records;
  if (Array.isArray(raw.pages)) {
    records = extractFromRaw(raw);
  } else if (Array.isArray(raw.articles)) {
    records = extractFromStructured(raw);
  } else {
    console.error("Unsupported input JSON shape. Expected top-level pages[] or articles[].");
    process.exit(1);
  }

  const filtered = records.filter((r) => {
    if (args.includeEmpty) return true;
    const body = normalizeText(r.body);
    if (body.length < args.minChars) return false;
    if (countWords(body) < args.minWords) return false;
    if (countSentences(body) < args.minSentences) return false;
    if (isLikelyNonStory(body)) return false;
    return true;
  });
  const payload = buildPayload(filtered, sourceName);

  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  if (args.format === "json") {
    fs.writeFileSync(args.output, JSON.stringify(payload, null, 2));
  } else {
    fs.writeFileSync(args.output, payload.map((p) => JSON.stringify(p)).join("\n") + "\n");
  }

  console.log(`Wrote ${payload.length} article payloads to ${args.output}`);

  if (args.apiUrl) {
    const result = await postArticles(args.apiUrl, args.apiToken, payload);
    console.log(`API import complete. success=${result.success} failed=${result.failed}`);
  }

  if (args.publishDir) {
    const result = writeEditorialMdx(payload, args);
    console.log(
      `Editorial publish ${args.dryRun ? "preview" : "complete"}: wrote=${result.written.length} skipped=${result.skipped.length} dir=${result.targetDir}`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
