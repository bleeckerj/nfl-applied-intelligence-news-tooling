const fs = require('fs');
const path = require('path');
const https = require('https');

// Configuration
const SOURCE_FILE = path.join(__dirname, '../content/issue-threaded.json');
const OUTPUT_FILE = path.join(__dirname, '../dist/indesign-data.json');
const IMAGE_DIR = path.join(__dirname, '../dist/images');

// Helper to download image
function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close(resolve);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// Helper to process image paths (Local or URL)
async function processImage(imagePath) {
    if (!imagePath) return null;

    // If it's a URL
    if (imagePath.startsWith('http')) {
        const filename = path.basename(new URL(imagePath).pathname) || 'downloaded-image.jpg';
        const localDest = path.join(IMAGE_DIR, filename);
        
        if (!fs.existsSync(IMAGE_DIR)) {
            fs.mkdirSync(IMAGE_DIR, { recursive: true });
        }

        console.log(`Downloading: ${imagePath} -> ${localDest}`);
        try {
            await downloadImage(imagePath, localDest);
            return localDest; // Return the new local path
        } catch (e) {
            console.error(`Failed to download ${imagePath}:`, e);
            return null;
        }
    }
    
    // If it's already local, resolve absolute path
    return path.resolve(__dirname, '..', imagePath);
}

// Main Bundler
async function bundle() {
    console.log(`Reading source: ${SOURCE_FILE}`);
    
    if (!fs.existsSync(SOURCE_FILE)) {
        console.error("Source file not found!");
        process.exit(1);
    }

    const sourceData = JSON.parse(fs.readFileSync(SOURCE_FILE, 'utf8'));
    
    // Transform data for InDesign
    const pages = await Promise.all(sourceData.pages.map(async page => {
        
        // Process Lead Image if it exists (Example structure)
        let leadImage = null;
        if (page.lead && page.lead.image) {
            leadImage = await processImage(page.lead.image);
        }

        return {
            type: "frontpage",
            masthead: page.masthead,
            lead: {
                headline: page.lead.headline,
                dek: page.lead.dek,
                byline: page.lead.byline,
                body: page.lead.body,
                image: leadImage // Now guaranteed to be a local path
            },
            sidebar: page.sidebar ? {
                title: page.sidebar.headline,
                items: page.sidebar.items
            } : null
        };
    }));

    const indesignData = {
        issue: sourceData.issue,
        date: sourceData.date,
        pages: pages
    };

    // Ensure dist exists
    const distDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(indesignData, null, 2));
    console.log(`Bundled data written to: ${OUTPUT_FILE}`);
}

bundle();
