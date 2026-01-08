import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const ISSUE_JSON_PATH = path.resolve(__dirname, '../../nfl-remember-the-future/intelligence_transition_full_issue.json');
const DRAFTS_DIR = path.resolve(__dirname, '../../nfl-remember-the-future/drafts');
const ASSIGNMENTS_PATH = path.resolve(__dirname, '../ai-newspaper-tabloid_03_assignments.json');
const LAYOUT_MAP_PATH = path.resolve(__dirname, '../ai-newspaper-tabloid_03_layout-map.json');
const OUTPUT_PATH = path.resolve(__dirname, '../ai-newspaper-tabloid_03_assignments_filled.json');

// Helper to read JSON
function readJSON(filepath) {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// Helper to find draft file by ID
function findDraftFile(id) {
    const files = fs.readdirSync(DRAFTS_DIR);
    const prefix = id.toString().padStart(2, '0');
    const match = files.find(f => f.startsWith(prefix + '_'));
    if (match) {
        return fs.readFileSync(path.join(DRAFTS_DIR, match), 'utf8');
    }
    return null;
}

async function main() {
    console.log("Loading data...");
    const issueData = readJSON(ISSUE_JSON_PATH);
    const assignmentsData = readJSON(ASSIGNMENTS_PATH);
    const layoutMap = readJSON(LAYOUT_MAP_PATH);

    const articles = issueData.articles;
    let articleIndex = 0;

    console.log(`Found ${articles.length} articles.`);

    // Iterate through pages in the assignments file
    for (let i = 0; i < assignmentsData.pages.length; i++) {
        const page = assignmentsData.pages[i];
        const pageId = page.id; // e.g. "p1"
        
        // Find corresponding page in layout map to check capacities/types
        // Layout map pages are array, index matches?
        // The layout map has "name": "1", assignments has "id": "p1". 
        // We can assume index i matches for now.
        
        console.log(`Processing Page ${pageId}...`);

        const assignments = page.assignments;
        const frameNames = Object.keys(assignments);

        // Sort frames by estimated words (descending) to find the "Main Story" slots
        const framesWithCapacity = frameNames.map(name => {
            const assignment = assignments[name];
            return {
                name: name,
                capacity: assignment.estimated_words || 0,
                assignment: assignment
            };
        }).sort((a, b) => b.capacity - a.capacity);

        // Heuristic: If a frame has > 100 words capacity, it's a story slot.
        // If it's < 100, it might be a headline, caption, or byline.
        
        for (const frame of framesWithCapacity) {
            if (articleIndex >= articles.length) break;

            // Skip if already filled (unless it's placeholder)
            if (frame.assignment.content && 
                frame.assignment.content !== "CONTENT GOES HERE" && 
                !frame.assignment.content.includes("PLACEHOLDER")) {
                continue;
            }

            // Is this a main story body?
            if (frame.capacity > 150) {
                const article = articles[articleIndex];
                console.log(`  Assigning Article ${article.id}: "${article.title}" to ${frame.name} (${frame.capacity} words)`);

                // Get Content
                let content = findDraftFile(article.id);
                if (!content) {
                    content = `[Draft for Article ${article.id} not found]\n\n${article.lede}`;
                }

                // Clean content (remove markdown headers if needed, or keep them)
                // For now, we just dump the raw markdown text. InDesign might need tagging, 
                // but the ingest script applies a paragraph style.
                
                frame.assignment.content = content;
                
                // Try to find associated headline/byline frames nearby?
                // This is hard without spatial awareness. 
                // But we can look for frames named similarly or just leave them for manual fix.
                
                articleIndex++;
            } 
            // Is this a headline? (Small capacity, style contains "Head")
            else if (frame.assignment.style && frame.assignment.style.includes("Head")) {
                // If we just assigned an article, maybe this is its headline?
                // This is risky. Let's just put a placeholder or try to match the LAST assigned article.
                if (articleIndex > 0) {
                    const lastArticle = articles[articleIndex - 1];
                    // Only overwrite if it looks like a placeholder
                    if (frame.assignment.content === "CONTENT GOES HERE") {
                         frame.assignment.content = lastArticle.title;
                    }
                }
            }
             // Is this a byline?
            else if (frame.assignment.style && frame.assignment.style.includes("Byline")) {
                if (articleIndex > 0) {
                    const lastArticle = articles[articleIndex - 1];
                    if (frame.assignment.content === "CONTENT GOES HERE") {
                         frame.assignment.content = "By " + lastArticle.byline;
                    }
                }
            }
        }
    }

    // Write output
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(assignmentsData, null, 2));
    console.log(`\nMapping complete. Saved to: ${OUTPUT_PATH}`);
    console.log("Review this file, then rename it to overwrite the original assignments file if satisfied.");
}

main().catch(err => console.error(err));
