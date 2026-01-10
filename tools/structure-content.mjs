import fs from 'fs';
import path from 'path';

// Usage: node tools/structure-content.mjs <input-file.json>
// Input file comes from the extract-content.jsx script

const inputFile = process.argv[2];

if (!inputFile) {
    console.error("Please provide an input JSON file.");
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));

// Configuration
const CONFIG = {
    // If a story is longer than this, it's considered a "Main Article" anchor
    MIN_BODY_LENGTH: 400, 
    // Max distance to consider grouping (in points/units of the doc)
    // 72 pts = 1 inch. 500 is roughly 7 inches. Adjust as needed.
    MAX_GROUPING_DISTANCE: 1000 
};

function calculateDistance(itemA, itemB) {
    const dx = itemA.center.x - itemB.center.x;
    const dy = itemA.center.y - itemB.center.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function processPage(page) {
    const anchors = [];
    const candidates = [];

    // 1. Identification Phase
    page.items.forEach(item => {
        if (!item.bounds) return; // Skip items without geometry

        const isText = item.type === "TextFrame";
        
        // Is this an anchor?
        // It must be text, and either have a long story OR match a specific style if we knew it.
        // We rely on storyLength.
        if (isText && item.storyLength > CONFIG.MIN_BODY_LENGTH) {
            anchors.push({
                ...item,
                attachments: [] 
            });
        } else {
            // It's a candidate for attachment (Headline, Image, Caption, etc.)
            candidates.push(item);
        }
    });

    // 2. Clustering Phase
    candidates.forEach(candidate => {
        let bestAnchor = null;
        let minDistance = Infinity;

        anchors.forEach(anchor => {
            const dist = calculateDistance(candidate, anchor);
            if (dist < minDistance) {
                minDistance = dist;
                bestAnchor = anchor;
            }
        });

        if (bestAnchor && minDistance < CONFIG.MAX_GROUPING_DISTANCE) {
            bestAnchor.attachments.push({
                item: candidate,
                distance: minDistance,
                role: guessRole(candidate)
            });
        } else {
            // Orphan
             // Perhaps it's a short independent story?
             // Let's keep it as a separate "Short Item"
             anchors.push({
                 ...candidate,
                 isOrphan: true,
                 attachments: []
             });
        }
    });

    return anchors;
}

function guessRole(item) {
    if (item.type !== "TextFrame") return "Image/Graphic";
    
    // Simple heuristics
    const content = item.content || "";
    if (content.length < 100 && content.length > 5) return "Headline/Byline";
    if (content.length < 50 && content.toLowerCase().includes("by")) return "Byline";
    
    return "Unknown Text";
}


// Main Processing
const structuredPages = rawData.pages.map(p => {
    return {
        pageName: p.name,
        width: p.width,   // Pass through page dimensions
        height: p.height,
        clusters: processPage(p)
    };
});

// Post-Processing: Merge clusters by Story ID to form complete Articles
const articles = {};
const pageMeta = {}; // Store page dimensions

structuredPages.forEach(page => {
    pageMeta[page.pageName] = { width: page.width, height: page.height };
    
    page.clusters.forEach(cluster => {
        // If it's a text story, use StoryID as the key
        const key = cluster.storyId || `orphan_${cluster.id}`;
        
        if (!articles[key]) {
            articles[key] = {
                storyId: cluster.storyId,
                frames: [],
                relatedItems: [],
                fullTextCandidate: null
            };
        }

        // Capture full text if this frame has it
        if (cluster.isStoryStart && cluster.storyFullText) {
            articles[key].fullTextCandidate = cluster.storyFullText;
        }

        articles[key].frames.push({
            page: page.pageName,
            content: cluster.content,
            bounds: cluster.bounds
        });

        // Add attachments
        if (cluster.attachments) {
            cluster.attachments.forEach(att => {
                articles[key].relatedItems.push({
                    page: page.pageName,
                    type: att.role,
                    content: att.item.content || att.item.linkPath,
                    bounds: att.item.bounds
                });
            });
        }
    });
});

// Final Cleanup
const output = {
    metadata: {
        ...rawData.metadata,
        pageDimensions: pageMeta
    },
    articles: Object.values(articles).map(a => {
        // Use full text if captured, otherwise fallback to joining frames (less reliable ordering)
        const text = a.fullTextCandidate || a.frames.map(f => f.content).join("\n\n");
        
        return {
            id: a.storyId,
            full_text: text,
            frames: a.frames,
            components: a.relatedItems
        };
    })
};

const outputFilename = inputFile.replace(/\.json$/, "_structured.json");
fs.writeFileSync(outputFilename, JSON.stringify(output, null, 2));

console.log(`Structured content saved to ${outputFilename}`);
