// tools/export-layout-map.jsx
// Run this script from Adobe InDesign to export a JSON map of the current document.

function main(args) {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    
    // Determine document/template name
    // If arguments are passed (from run-id-script), use the first argument as the template name
    var docName = doc.name;
    if (args && args.length > 0 && args[0]) {
        docName = args[0];
    }

    var layoutMap = {
        metadata: {
            documentName: docName,
            generatedAt: new Date().toString(),
            pageWidth: doc.documentPreferences.pageWidth,
            pageHeight: doc.documentPreferences.pageHeight,
            units: getUnitName(doc.viewPreferences.horizontalMeasurementUnits)
        },
        pages: []
    };

    // Turn off interaction for speed and to prevent dialogs
    var originalInteractionLevel = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

    try {
        for (var i = 0; i < doc.pages.length; i++) {
            var page = doc.pages[i];
            var pageData = {
                name: page.name,
                index: i,
                items: []
            };

            var pageItems = page.allPageItems;
            for (var j = 0; j < pageItems.length; j++) {
                var item = pageItems[j];
                
                if (!item.isValid) continue;

                var bounds = item.geometricBounds; // [y1, x1, y2, x2]
                var height = bounds[2] - bounds[0];
                var width = bounds[3] - bounds[1];

                // Auto-assign name if missing (Syncs with make-flatplan logic)
                if (!item.name || item.name === "") {
                    var typePrefix = (item instanceof TextFrame) ? "TF" : "Obj";
                    // Use page name and index. Note: allPageItems order is z-order (stacking).
                    item.name = typePrefix + "_P" + page.name + "_" + (j + 1);
                }

                var itemData = {
                    id: item.id,
                    name: item.name,
                    type: getItemType(item),
                    bounds: bounds,
                    dimensions: {
                        width: width,
                        height: height
                    },
                    label: item.label
                };

                try {
                    itemData.contentType = item.contentType.toString();
                } catch(e) {
                    itemData.contentType = "Unknown";
                }

                if (item instanceof TextFrame) {
                    // Text Frame Logic
                    itemData.content = item.contents;
                    
                    // Style Info
                    if (item.paragraphs.length > 0) {
                        itemData.paragraphStyle = item.paragraphs[0].appliedParagraphStyle.name;
                    }

                    // Threading Info
                    try {
                        if (item.nextTextFrame && item.nextTextFrame.isValid) {
                            itemData.nextTextFrameId = item.nextTextFrame.id;
                        }
                    } catch(e) {}

                    try {
                        if (item.previousTextFrame && item.previousTextFrame.isValid) {
                            itemData.previousTextFrameId = item.previousTextFrame.id;
                        }
                    } catch(e) {}

                    // Determine if this is the start of a story
                    // It is the start if it has NO previous frame, or if it's not threaded at all.
                    itemData.isStoryStart = !itemData.previousTextFrameId;
                    itemData.isThreaded = (itemData.nextTextFrameId || itemData.previousTextFrameId) ? true : false;

                    // Capacity Estimation
                    // We only estimate if it's not threaded or it's the start of a thread
                    // to avoid double counting or messing up flows too much.
                    
                    itemData.capacity = estimateTextCapacity(item);
                    
                    // Stub for JSON
                    itemData.stub = {
                        text: "FPO: " + itemData.name,
                        estimated_chars: itemData.capacity.chars,
                        estimated_words: itemData.capacity.words
                    };

                } else if (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) {
                    // Image Frame Logic
                    itemData.stub = {
                        image_path: "",
                        caption: "FPO: Caption for " + itemData.name,
                        alt_text: ""
                    };
                }

                pageData.items.push(itemData);
            }
            layoutMap.pages.push(pageData);
        }
    } catch(e) {
        alert("Error generating map: " + e);
    } finally {
        // Restore interaction level
        app.scriptPreferences.userInteractionLevel = originalInteractionLevel;
    }

    // Save to file
    var scriptFile = new File($.fileName);
    var defaultFolder = scriptFile.parent.parent; // Project root
    
    // Construct a default filename based on the document name (or passed argument)
    var baseName = docName.replace(/\.[^\.]+$/, ""); // Remove extension
    var defaultName = baseName + "_layout-map.json";
    var defaultPath = defaultFolder.fsName + "/" + defaultName;
    
    // Use saveDlg() on a File instance to set the default filename
    var outputFile = new File(defaultPath).saveDlg("Save Layout Map JSON", "*.json");
    
    if (outputFile) {
        outputFile.encoding = "UTF-8";
        outputFile.open("w");
        outputFile.write(JSON_stringify(layoutMap));
        outputFile.close();
        alert("Layout map exported to " + outputFile.fsName);

        // Also generate the blank issue2template.json
        generateBlankAssignmentFile(layoutMap, baseName, defaultFolder);
    }
}

function generateBlankAssignmentFile(layoutMap, baseName, folder) {
    var assignmentMap = {
        metadata: {
            templateName: layoutMap.metadata.documentName,
            flatplanFile: baseName + "_layout-map.json",
            generatedAt: new Date().toString()
        },
        pages: []
    };

    for (var i = 0; i < layoutMap.pages.length; i++) {
        var page = layoutMap.pages[i];
        var pageAssignments = {
            id: "p" + page.name,
            assignments: {}
        };

        for (var j = 0; j < page.items.length; j++) {
            var item = page.items[j];
            
            // Only create assignments for TextFrames and Image Frames (Rectangles)
            // Skip GraphicLines, Groups, etc unless needed
            if (item.type === "TextFrame") {
                // Threading Logic:
                // If this frame is part of a thread but NOT the start, we skip it in the assignment file.
                // The content should be assigned to the start of the story.
                if (item.previousTextFrameId) {
                    // This is a continuation frame. Skip.
                    continue;
                }

                var assignmentEntry = {
                    content: "CONTENT GOES HERE",
                    style: item.paragraphStyle || "Body Text",
                    estimated_words: item.capacity ? item.capacity.words : 0
                };

                if (item.isThreaded) {
                    assignmentEntry.note = "This is the start of a threaded story. Content will flow automatically to subsequent frames.";
                }

                pageAssignments.assignments[item.name] = assignmentEntry;

            } else if (item.type === "Rectangle" || item.type === "Oval" || item.type === "Polygon") {
                pageAssignments.assignments[item.name] = {
                    src: "images/placeholder.jpg", // Can be a local path (relative to project root) or a URL
                    caption: "Caption goes here"
                };
            }
        }
        assignmentMap.pages.push(pageAssignments);
    }

    var assignmentFile = new File(folder.fsName + "/" + baseName + "_assignments.json");
    assignmentFile.encoding = "UTF-8";
    assignmentFile.open("w");
    assignmentFile.write(JSON_stringify(assignmentMap, 2));
    assignmentFile.close();
    // We don't alert for this one to avoid spamming dialogs, but it's saved next to the map.
}

function getUnitName(unit) {
    // Map enum to string (simplified)
    return String(unit);
}

function estimateTextCapacity(textFrame) {
    // This is destructive! We must undo or restore.
    // Since we can't easily "Undo" via script without overhead, 
    // we will save the current content, fill, measure, and restore.
    
    var originalContent = textFrame.contents;
    var capacity = { chars: 0, words: 0 };

    try {
        // If threaded, this might affect other frames. 
        // Ideally we should only do this on a copy of the document.
        // But assuming the user is running this on a template...
        
        // Fill with placeholder text
        textFrame.contents = TextFrameContents.PLACEHOLDER_TEXT;
        
        // Measure
        capacity.chars = textFrame.contents.length;
        // Simple word count approximation
        capacity.words = textFrame.contents.split(/\s+/).length;
        
        // Restore (this might not restore formatting perfectly if it was complex)
        // But for a template with empty boxes, it's fine.
        textFrame.contents = originalContent;
        
    } catch(e) {
        // Ignore errors
    }
    
    return capacity;
}

function getItemType(item) {
    try {
        return item.constructor.name;
    } catch(e) {
        return "Unknown";
    }
}

// Simple JSON stringifier for ExtendScript with indentation
function JSON_stringify(obj, indentLevel) {
    indentLevel = indentLevel || 0;
    var indent = "";
    for (var i = 0; i < indentLevel; i++) indent += "  ";
    var nextIndent = indent + "  ";

    var t = typeof (obj);
    if (t != "object" || obj === null) {
        // simple data type
        if (t == "string") obj = '"' + obj.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
        return String(obj);
    } else {
        // recurse array or object
        var n, v, json = [], arr = (obj && obj.constructor == Array);
        for (n in obj) {
            v = obj[n];
            t = typeof (v);
            if (t == "function") continue; // skip functions
            if (t == "string") v = '"' + v.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
            else if (t == "object" && v !== null) v = JSON_stringify(v, indentLevel + 1);
            
            json.push((arr ? "" : '"' + n + '": ') + String(v));
        }
        
        if (json.length === 0) return (arr ? "[]" : "{}");
        
        return (arr ? "[\n" + nextIndent : "{\n" + nextIndent) + 
               json.join(",\n" + nextIndent) + 
               (arr ? "\n" + indent + "]" : "\n" + indent + "}");
    }
}

main(typeof arguments !== "undefined" ? arguments : []);
