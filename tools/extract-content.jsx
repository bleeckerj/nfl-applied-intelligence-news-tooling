// tools/extract-content.jsx
// Run this script from Adobe InDesign to extract content and geometry from the current document.
// This is non-destructive (read-only).

function main() {
    // Check if arguments were passed (from external runner)
    // arguments[0] might be the filename if opened via run-id-script.mjs
    var args = (typeof arguments !== "undefined") ? arguments : [];

    if (app.documents.length === 0) {
        // If no doc open, but we expect one might be opening or we messed up
        if (args.length > 0) {
             // giving it a moment? No, run-id-script handles opening.
             // If we are here, something failed to open.
             return "Error: No document open.";
        }
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var data = {
        metadata: {
            documentName: doc.name,
            generatedAt: new Date().toString(),
            pageWidth: doc.documentPreferences.pageWidth,
            pageHeight: doc.documentPreferences.pageHeight
        },
        pages: []
    };

    // Save original interaction level and preferences
    var originalInteractionLevel = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;
    
    // Save original units
    var originalHUnits = doc.viewPreferences.horizontalMeasurementUnits;
    var originalVUnits = doc.viewPreferences.verticalMeasurementUnits;
    var originalRuler = doc.viewPreferences.rulerOrigin;

    // Force units to Points for consistent web-friendly geometry (1 pt = ~1 px)
    doc.viewPreferences.horizontalMeasurementUnits = MeasurementUnits.POINTS;
    doc.viewPreferences.verticalMeasurementUnits = MeasurementUnits.POINTS;
    doc.viewPreferences.rulerOrigin = RulerOrigin.PAGE_ORIGIN; // (0,0) is top-left of EACH page

    try {
        for (var i = 0; i < doc.pages.length; i++) {
            var page = doc.pages[i];
            
            // With PAGE_ORIGIN, we don't need complex offsets. 
            // bounds[0] is y1 relative to top of page.
            
            // Get page dimensions (normalize single page size)
            // page.bounds is always Pasteboard coords, so we can't use it for width/height easily here.
            // But we can check the document preferences or calculate from bounds if we are careful.
            // Safer: Use document setup if pages are uniform, or calculate from page.bounds differences.
            var pB = page.bounds; // [y1, x1, y2, x2]
            var pWidth = pB[3] - pB[1];
            var pHeight = pB[2] - pB[0];

            var pageData = {
                name: page.name,
                index: i,
                width: pWidth,
                height: pHeight,
                items: []
            };

            var pageItems = page.allPageItems;
            
            // simple loop
            for (var j = 0; j < pageItems.length; j++) {
                var item = pageItems[j];
                
                if (!item.isValid) continue;

                 // Skip Groups to avoid overlapping bounding boxes
                if (item instanceof Group) continue;

                var bounds = item.geometricBounds; // [y1, x1, y2, x2]
                
                // With RulerOrigin.PAGE_ORIGIN, these are already correct!
                var y1 = bounds[0];
                var x1 = bounds[1];
                var y2 = bounds[2];
                var x2 = bounds[3];

                var itemData = {
                    id: item.id,
                    type: getItemType(item),
                    bounds: [y1, x1, y2, x2],
                    // Calculate center point for easier proximity math later
                    center: {
                        x: (bounds[1] + bounds[3]) / 2,
                        y: (bounds[0] + bounds[2]) / 2
                    },
                    area: (bounds[2] - bounds[0]) * (bounds[3] - bounds[1])
                };

                if (item instanceof TextFrame) {
                    itemData.content = item.contents;
                    
                    // Story Info
                    if (item.parentStory) {
                        itemData.storyId = item.parentStory.id;
                        itemData.storyLength = item.parentStory.contents.length;
                        
                        // Optimization: Only grab full text for the first frame in a thread
                        // or if it's not threaded.
                        var isStart = !item.previousTextFrame;
                        if (isStart) {
                             itemData.storyFullText = item.parentStory.contents;
                             itemData.isStoryStart = true;
                        }
                    }

                    // Style Info (First paragraph often dictates "Headline" vs "Body")
                    if (item.paragraphs.length > 0) {
                         try {
                            itemData.firstParagraphStyle = item.paragraphs[0].appliedParagraphStyle.name;
                            itemData.firstParagraphContent = item.paragraphs[0].contents;
                        } catch(e) {}
                    }
                    
                    // Threading
                    itemData.nextTextFrameId = (item.nextTextFrame && item.nextTextFrame.isValid) ? item.nextTextFrame.id : null;
                    itemData.previousTextFrameId = (item.previousTextFrame && item.previousTextFrame.isValid) ? item.previousTextFrame.id : null;

                } else if (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) {
                    itemData.contentType = item.contentType.toString();
                    // Grab linked image path if it exists
                    if (item.allGraphics.length > 0) {
                        try {
                            itemData.linkPath = item.allGraphics[0].itemLink.filePath;
                        } catch(e) {
                            itemData.linkPath = "embedded-or-missing";
                        }
                    }
                }

                pageData.items.push(itemData);
            }
            data.pages.push(pageData);
        }
    } catch(e) {
        alert("Error extracting content: " + e);
    } finally {
        // Restore preferences
        try {
            app.scriptPreferences.userInteractionLevel = originalInteractionLevel;
            doc.viewPreferences.horizontalMeasurementUnits = originalHUnits;
            doc.viewPreferences.verticalMeasurementUnits = originalVUnits;
            doc.viewPreferences.rulerOrigin = originalRuler;
        } catch(e) {}
    }

    // Save
    var extractedName = doc.name.replace(/\.[^\.]+$/, "") + "_extracted.json";
    var outputFolder;
    
    // Attempt to save alongside the document, otherwise fallback to project root
    try {
        outputFolder = doc.filePath;
    } catch(e) {
        // Document might not be saved yet
        var scriptFile = new File($.fileName);
        outputFolder = scriptFile.parent.parent;
    }

    var outputFile = new File(outputFolder.fsName + "/" + extractedName);

    // If running with arguments (headless mode), don't show dialog
    var useDialog = (arguments.length === 0);
    
    // Override: If we are running headless, never show dialog. 
    // We can detect headless roughly by checking if we passed arguments intended for automation
    // But for now, let's just make it save silently if arguments are present
    // OR if we want to force this behavior.
    
    // Actually, just save silently. It's an extraction script. 
    // If user wants to choose, they can move it later. Automation first.
    
    outputFile.encoding = "UTF-8";
    outputFile.open("w");
    outputFile.write(JSON_stringify(data));
    outputFile.close();
    
    // Only alert if we think we are in GUI mode (no args passed usually implies manual run)
    if (arguments.length === 0) {
        alert("Extraction complete! File saved to: " + outputFile.fsName);
    } else {
        // Return path for the caller (AppleScript result)
        return outputFile.fsName;
    }
}

function getItemType(item) {
    try { return item.constructor.name; } catch(e) { return "Unknown"; }
}

// Standard JSON stringify for ES3
function JSON_stringify(obj, indentLevel) {
    // Basic implementation sufficient for this data
    indentLevel = indentLevel || 0;
    var indent = ""; 
    for(var k=0; k<indentLevel; k++) indent += "  ";
    
    var type = typeof obj;
    if (obj === null) return "null";
    if (type === "undefined") return "undefined";
    if (type === "number" || type === "boolean") return String(obj);
    if (type === "string") {
        return '"' + obj.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/[\x00-\x1f]/g, function(c) {
                switch(c) {
                    case '\b': return '\\b';
                    case '\t': return '\\t';
                    case '\n': return '\\n';
                    case '\f': return '\\f';
                    case '\r': return '\\r';
                    default: 
                        var hex = c.charCodeAt(0).toString(16);
                        return "\\u" + ("0000" + hex).slice(-4);
                }
            }) + '"';
    }
    
    if (type === "object") {
        if (obj instanceof Array) {
            var res = [];
            for (var i = 0; i < obj.length; i++) res.push(JSON_stringify(obj[i], indentLevel+1));
            return "[\n" + indent + "  " + res.join(",\n" + indent + "  ") + "\n" + indent + "]";
        } else {
            var res = [];
            for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                    res.push('"' + key + '": ' + JSON_stringify(obj[key], indentLevel+1));
                }
            }
            return "{\n" + indent + "  " + res.join(",\n" + indent + "  ") + "\n" + indent + "}";
        }
    }
    return '""'; // Fallback
}

main();
