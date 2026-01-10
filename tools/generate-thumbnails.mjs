#!/usr/bin/env node
/**
 * generate-thumbnails.mjs
 * 
 * Reads a _structured.json file and generates web-friendly thumbnails
 * for all linked images. Thumbnails are saved alongside the JSON file
 * in a 'thumbnails' folder.
 * 
 * Usage:
 *   node tools/generate-thumbnails.mjs path/to/_structured.json
 * 
 * This allows the Asset Navigator to show image previews without
 * requiring manual folder selection.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const THUMBNAIL_MAX_SIZE = 400; // Max width/height in pixels

async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        // Try to find a _structured.json file
        const files = fs.readdirSync('.').filter(f => f.endsWith('_structured.json'));
        if (files.length === 0) {
            console.error('Usage: node tools/generate-thumbnails.mjs <path-to-structured.json>');
            console.error('   or: run from a directory containing a _structured.json file');
            process.exit(1);
        }
        args.push(files[0]);
    }

    const jsonPath = path.resolve(args[0]);
    
    if (!fs.existsSync(jsonPath)) {
        console.error(`File not found: ${jsonPath}`);
        process.exit(1);
    }

    console.log(`Reading: ${jsonPath}`);
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

    // Create thumbnails directory next to the JSON file
    const jsonDir = path.dirname(jsonPath);
    const thumbDir = path.join(jsonDir, 'thumbnails');
    
    if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
    }

    // Collect all unique image paths
    const imagePaths = new Set();
    
    for (const article of (data.articles || [])) {
        for (const comp of (article.components || [])) {
            if (comp.type === 'Image/Graphic' && comp.content) {
                imagePaths.add(comp.content);
            }
        }
    }

    console.log(`Found ${imagePaths.size} unique images`);

    // Check if we have sips (macOS) or ImageMagick
    let converter = null;
    try {
        execSync('which sips', { stdio: 'ignore' });
        converter = 'sips';
    } catch {
        try {
            execSync('which convert', { stdio: 'ignore' });
            converter = 'imagemagick';
        } catch {
            console.error('Error: No image converter found. Need either sips (macOS) or ImageMagick.');
            process.exit(1);
        }
    }

    console.log(`Using ${converter} for conversion`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    // Create a manifest to map original filenames to thumbnails
    const manifest = {};

    for (const imagePath of imagePaths) {
        const filename = path.basename(imagePath);
        const ext = path.extname(filename).toLowerCase();
        
        // Output as JPEG for web compatibility
        const thumbName = filename.replace(/\.[^.]+$/, '.jpg');
        const thumbPath = path.join(thumbDir, thumbName);

        // Skip if thumbnail already exists and is newer than source
        if (fs.existsSync(thumbPath)) {
            try {
                const srcStat = fs.statSync(imagePath);
                const thumbStat = fs.statSync(thumbPath);
                if (thumbStat.mtime >= srcStat.mtime) {
                    manifest[filename] = thumbName;
                    skipped++;
                    continue;
                }
            } catch {
                // Source doesn't exist, skip
            }
        }

        // Check if source exists
        if (!fs.existsSync(imagePath)) {
            console.warn(`  Missing: ${filename}`);
            failed++;
            continue;
        }

        // Convert based on file type
        try {
            if (converter === 'sips') {
                // sips works great on macOS for most formats
                if (['.jpg', '.jpeg', '.png', '.gif', '.tif', '.tiff', '.heic'].includes(ext)) {
                    execSync(`sips -s format jpeg -Z ${THUMBNAIL_MAX_SIZE} "${imagePath}" --out "${thumbPath}"`, {
                        stdio: 'ignore'
                    });
                    manifest[filename] = thumbName;
                    processed++;
                    process.stdout.write(`\r  Processed: ${processed}/${imagePaths.size}`);
                } else if (['.psd', '.ai', '.eps', '.pdf'].includes(ext)) {
                    // For these, try sips first, fall back to just copying a placeholder
                    try {
                        execSync(`sips -s format jpeg -Z ${THUMBNAIL_MAX_SIZE} "${imagePath}" --out "${thumbPath}"`, {
                            stdio: 'ignore'
                        });
                        manifest[filename] = thumbName;
                        processed++;
                    } catch {
                        // Create a placeholder for unsupported formats
                        skipped++;
                    }
                    process.stdout.write(`\r  Processed: ${processed}/${imagePaths.size}`);
                } else {
                    skipped++;
                }
            } else {
                // ImageMagick
                execSync(`convert "${imagePath}[0]" -resize ${THUMBNAIL_MAX_SIZE}x${THUMBNAIL_MAX_SIZE}\\> -quality 80 "${thumbPath}"`, {
                    stdio: 'ignore'
                });
                manifest[filename] = thumbName;
                processed++;
                process.stdout.write(`\r  Processed: ${processed}/${imagePaths.size}`);
            }
        } catch (err) {
            console.warn(`\n  Failed: ${filename} - ${err.message}`);
            failed++;
        }
    }

    console.log(`\n\nDone!`);
    console.log(`  Processed: ${processed}`);
    console.log(`  Skipped (up to date): ${skipped}`);
    console.log(`  Failed: ${failed}`);
    console.log(`\nThumbnails saved to: ${thumbDir}`);

    // Save manifest
    const manifestPath = path.join(thumbDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`Manifest saved to: ${manifestPath}`);

    // Update the structured JSON to include thumbnail info
    const jsonBasename = path.basename(jsonPath, '.json');
    const updatedJsonPath = path.join(jsonDir, jsonBasename + '_with_thumbs.json');
    
    // Add thumbnail paths to the data
    for (const article of (data.articles || [])) {
        for (const comp of (article.components || [])) {
            if (comp.type === 'Image/Graphic' && comp.content) {
                const filename = path.basename(comp.content);
                if (manifest[filename]) {
                    comp.thumbnail = `thumbnails/${manifest[filename]}`;
                }
            }
        }
    }
    
    fs.writeFileSync(updatedJsonPath, JSON.stringify(data, null, 2));
    console.log(`Updated JSON saved to: ${updatedJsonPath}`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
