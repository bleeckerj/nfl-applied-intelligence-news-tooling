// tools/ingest-assignments.jsx
// Run this script from Adobe InDesign to populate the template with content from an assignments JSON file.

function main(args) {
    if (app.documents.length === 0) {
        alert("Please open the target template/document first.");
        return;
    }

    var doc = app.activeDocument;
    
    // 1. Select Assignments File
    var assignmentFile;
    var projectRoot = new File($.fileName).parent.parent; // Script is in tools/, so parent.parent is root

    // Handle arguments
    // args[0] might be the document filename (e.g. "doc.indt") passed by the runner
    // or it might be the assignments file if the user passed it explicitly (though our runner passes doc name first)
    
    var potentialName = "";
    if (args && args.length > 0) {
        var arg = args[0];
        if (arg.match(/\.json$/i)) {
            // It's a JSON file
            assignmentFile = new File(arg);
            if (!assignmentFile.exists) {
                // Try relative to project root
                assignmentFile = new File(projectRoot.fsName + "/" + arg);
            }
        } else {
            // It's likely the document name (e.g. "ai-newspaper.indt")
            // Construct the expected JSON name
            potentialName = arg.replace(/\.[^\.]+$/, "");
        }
    }

    // If we haven't found it yet, try the potential name in the project root
    if ((!assignmentFile || !assignmentFile.exists) && potentialName) {
        var candidate = new File(projectRoot.fsName + "/" + potentialName + "_assignments.json");
        if (candidate.exists) {
            assignmentFile = candidate;
        }
    }

    // Fallback: Try to find based on the active document name (if it's saved)
    if (!assignmentFile || !assignmentFile.exists) {
        try {
            if (doc.saved) {
                var docName = doc.name.replace(/\.[^\.]+$/, "");
                var path = doc.filePath + "/" + docName + "_assignments.json";
                if (File(path).exists) assignmentFile = File(path);
            }
        } catch(e) {}
    }

    // If still not found, prompt user
    if (!assignmentFile || !assignmentFile.exists) {
        assignmentFile = File.openDialog("Select the Assignments JSON file", "*.json");
    }

    if (!assignmentFile) {
        return; // User cancelled
    }

    // 2. Read and Parse JSON
    assignmentFile.open("r");
    assignmentFile.encoding = "UTF-8";
    var jsonString = assignmentFile.read();
    assignmentFile.close();

    var data;
    try {
        // ExtendScript doesn't have native JSON.parse, using eval safely-ish
        data = eval("(" + jsonString + ")");
    } catch(e) {
        alert("Error parsing JSON file: " + e);
        return;
    }

    // 3. Process Assignments
    var projectRoot = assignmentFile.parent; // Assume images are relative to the JSON file
    
    // Turn off interaction for speed
    var originalInteractionLevel = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

    try {
        for (var i = 0; i < data.pages.length; i++) {
            var pageData = data.pages[i];
            
            // Find the page in the document
            // We assume the order matches or we try to match by name/index
            // The JSON has "id": "p1" which usually maps to page index 0 or name "1"
            
            var pageIndex = i; 
            if (pageIndex >= doc.pages.length) {
                // Page doesn't exist, maybe create it? For now, skip.
                continue;
            }
            
            var page = doc.pages[pageIndex];
            var assignments = pageData.assignments;

            for (var itemName in assignments) {
                if (!assignments.hasOwnProperty(itemName)) continue;
                
                var assignment = assignments[itemName];
                var item = page.pageItems.itemByName(itemName);

                if (item && item.isValid) {
                    processItem(item, assignment, projectRoot);
                } else {
                    // Fallback: Try to find by parsing the ID (e.g. TF_P1_3 -> Index 2)
                    // Format: [Type]_P[PageName]_[Index+1]
                    // We assume the page matches.
                    var parts = itemName.split('_');
                    if (parts.length >= 3) {
                        var indexStr = parts[parts.length - 1]; // Last part is the index (1-based)
                        var index = parseInt(indexStr, 10) - 1; // Convert to 0-based
                        
                        if (!isNaN(index) && index >= 0 && index < page.allPageItems.length) {
                            // Note: allPageItems is z-order. 
                            // We hope the order hasn't changed since export.
                            var candidate = page.allPageItems[index];
                            if (candidate.isValid) {
                                // Optional: Check type to be sure?
                                // var typePrefix = (candidate instanceof TextFrame) ? "TF" : "Obj";
                                // if (itemName.indexOf(typePrefix) === 0) ...
                                
                                processItem(candidate, assignment, projectRoot);
                            }
                        }
                    }
                }
            }
        }
        alert("Ingest complete!");
    } catch(e) {
        alert("Error during ingest: " + e);
    } finally {
        app.scriptPreferences.userInteractionLevel = originalInteractionLevel;
    }
}

function processItem(item, assignment, projectRoot) {
    if (item instanceof TextFrame) {
        // Text Content
        if (assignment.content) {
            // If it's "CONTENT GOES HERE", maybe we skip it if we want to preserve the template?
            // But usually we want to overwrite.
            if (assignment.content !== "CONTENT GOES HERE") {
                item.contents = assignment.content;
            }
        }
        
        // Apply Style (Optional)
        if (assignment.style) {
            try {
                var style = app.activeDocument.paragraphStyles.itemByName(assignment.style);
                if (style.isValid) {
                    item.paragraphs.everyItem().applyParagraphStyle(style, true);
                }
            } catch(e) {}
        }

    } else if (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) {
        // Image Content
        if (assignment.src && assignment.src !== "images/placeholder.jpg") {
            placeImage(item, assignment.src, projectRoot);
        }
        
        // Caption? 
        // If there is a caption field and we have a way to handle it (e.g. metadata or a grouped text frame)
        // For now, we ignore captions unless we have a specific convention.
    }
}

function placeImage(item, src, projectRoot) {
    var fileToPlace;

    // Check if URL
    if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) {
        fileToPlace = downloadImage(src);
    } else {
        // Local file
        // Resolve relative to project root
        fileToPlace = new File(projectRoot.fsName + "/" + src);
    }

    if (fileToPlace && fileToPlace.exists) {
        try {
            item.place(fileToPlace);
            item.fit(FitOptions.FILL_PROPORTIONALLY);
            item.fit(FitOptions.CENTER_CONTENT);
        } catch(e) {
            $.writeln("Failed to place image: " + src + " (" + e + ")");
        }
    } else {
        $.writeln("Image file not found: " + src);
    }
}

function downloadImage(url) {
    try {
        var tempFolder = Folder.temp.fsName;
        // Create a safe filename from URL
        var filename = url.split('/').pop().split('?')[0];
        if (!filename) filename = "downloaded_image.jpg";
        
        var targetFile = tempFolder + "/" + new Date().getTime() + "_" + filename;
        
        // Use curl to download
        var curlCmd = "curl -L -s '" + url + "' -o '" + targetFile + "'";
        var appleScript = 'do shell script "' + curlCmd + '"';
        
        app.doScript(appleScript, ScriptLanguage.APPLESCRIPT_LANGUAGE);
        
        var file = new File(targetFile);
        if (file.exists) return file;
        
    } catch(e) {
        $.writeln("Error downloading image: " + e);
    }
    return null;
}

main(typeof arguments !== "undefined" ? arguments : []);
