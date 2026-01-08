// tools/make-flatplan.jsx
// Run this script from Adobe InDesign.
// WARNING: This will OVERWRITE the content of text frames with their names/IDs.
// Use this on a COPY of your document to create a reference "flatplan".

function main(args) {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    
    // Determine document name from args if available
    var docName = doc.name;
    if (args && args.length > 0 && args[0]) {
        docName = args[0];
    }
    // Strip extension if present in the arg
    docName = docName.replace(/\.[^\.]+$/, "");
    var originalInteractionLevel = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

    // if (!confirm("This script will overwrite text content in this document to create a flatplan reference. \n\nAre you sure you want to proceed?")) {
    //    return;
    // }

    var counter = 1;

    try {
        for (var i = 0; i < doc.pages.length; i++) {
        var page = doc.pages[i];
        var pageItems = page.allPageItems;

        for (var j = 0; j < pageItems.length; j++) {
            var item = pageItems[j];
            
            // Check if object still exists (e.g. wasn't deleted by a previous action like clearing text containing anchored objects)
            if (!item.isValid) continue;

            try {
                // Generate a name if missing
                if (!item.name || item.name === "") {
                    var typePrefix = (item instanceof TextFrame) ? "TF" : "Obj";
                    item.name = typePrefix + "_P" + page.name + "_" + (j + 1);
                }

                // If it's a text frame, set content to name
                if (item instanceof TextFrame) {
                    var styleName = getStyleName(item);
                    var isBody = isBodyText(styleName);
                    
                    // Clear existing content (safest to avoid overflow issues before filling)
                    item.contents = "";
                    
                    if (isBody) {
                        // Fill with Greek text
                        item.contents = TextFrameContents.PLACEHOLDER_TEXT;
                        
                        // Prepend the Label
                        // We insert it at the beginning
                        item.insertionPoints[0].contents = item.name + " (" + styleName + ")\r";
                        
                        // Optional: Style the label to make it stand out?
                        // item.paragraphs[0].appliedFont = "Arial";
                        // item.paragraphs[0].fontStyle = "Bold";
                    } else {
                        // Just the label for headlines/captions
                        item.contents = item.name + "\n(" + styleName + ")";
                    }
                }
                // If it's a graphic frame (Rectangle, Oval, Polygon)
                else if (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) {
                    // Try to place a dynamic placeholder image
                    var success = placeDynamicPlaceholder(item);
                    
                    // Fallback to text label if placement failed
                    if (!success) {
                        createLabelFrame(page, item);
                    }
                }
            } catch(e) {
                // Log error but continue
                $.writeln("Error processing item " + j + ": " + e);
            }
        }
    }
    } catch(e) {
        alert("Error creating flatplan: " + e);
    } finally {
        app.scriptPreferences.userInteractionLevel = originalInteractionLevel;
    }

    // Export to PDF
    try {
        // Determine save folder: Use the script's folder's parent (project root)
        var scriptFile = new File($.fileName);
        var projectFolder = scriptFile.parent.parent;
        
        var pdfFile = new File(projectFolder.fsName + "/" + docName + "_flatplan.pdf");
        
        // Use "Smallest File Size" or "[High Quality Print]" preset if available, or default
        var pdfPreset = app.pdfExportPresets.item("[Smallest File Size]");
        if (!pdfPreset.isValid) {
            pdfPreset = app.pdfExportPresets.item("[High Quality Print]");
        }
        
        if (pdfPreset.isValid) {
            doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false, pdfPreset);
            alert("Flatplan created and exported to: " + pdfFile.fsName);
        } else {
            // Fallback without preset (might prompt dialog if interaction was on, but we turned it off/on)
            // Actually we restored interaction level.
            doc.exportFile(ExportFormat.PDF_TYPE, pdfFile);
            alert("Flatplan created and exported to: " + pdfFile.fsName);
        }
    } catch(e) {
        alert("Flatplan created, but PDF export failed: " + e);
    }
}

function getStyleName(textFrame) {
    if (textFrame.paragraphs.length > 0) {
        return textFrame.paragraphs[0].appliedParagraphStyle.name;
    }
    return "No Style";
}

function isBodyText(styleName) {
    var lower = styleName.toLowerCase();
    // Assume it's body if it contains these keywords
    if (lower.indexOf("body") !== -1) return true;
    if (lower.indexOf("text") !== -1) return true;
    if (lower.indexOf("standard") !== -1) return true;
    if (lower.indexOf("normal") !== -1) return true;
    if (lower.indexOf("para") !== -1) return true;
    
    // Or if it DOESN'T contain these
    if (lower.indexOf("head") !== -1) return false;
    if (lower.indexOf("title") !== -1) return false;
    if (lower.indexOf("caption") !== -1) return false;
    if (lower.indexOf("label") !== -1) return false;
    
    // Default to true if ambiguous? Or false?
    // Let's default to false to be safe, only filling obvious body text.
    return false;
}

function placeDynamicPlaceholder(item) {
    try {
        // 1. Calculate dimensions in pixels (approximate)
        // We assume 1 point = 1 pixel for the placeholder size, maybe scaled up slightly for quality
        var bounds = item.geometricBounds; // [y1, x1, y2, x2]
        var heightPts = convertToPoints(bounds[2] - bounds[0]);
        var widthPts = convertToPoints(bounds[3] - bounds[1]);
        
        var width = Math.round(widthPts);
        var height = Math.round(heightPts);
        
        if (width <= 0 || height <= 0) return false;

        // 2. Construct URL
        // https://fpoimg.com/800x400?text=IF_P1_1&bg_color=e6e6e6&text_color=444444
        var text = item.name;
        var url = "https://fpoimg.com/" + width + "x" + height + 
                  "?text=" + encodeURIComponent(text) + 
                  "&bg_color=e6e6e6&text_color=444444";

        // 3. Download image using curl (macOS only)
        var tempFolder = Folder.temp.fsName;
        var tempFile = tempFolder + "/placeholder_" + item.id + ".jpg";
        
        // AppleScript to run curl
        // We use -L to follow redirects, -s for silent
        var curlCmd = "curl -L -s '" + url + "' -o '" + tempFile + "'";
        
        var appleScript = 'do shell script "' + curlCmd + '"';
        
        app.doScript(appleScript, ScriptLanguage.APPLESCRIPT_LANGUAGE);
        
        // 4. Place the image
        var fileObj = new File(tempFile);
        if (fileObj.exists) {
            item.place(fileObj);
            item.fit(FitOptions.CONTENT_TO_FRAME);
            return true;
        }
        return false;

    } catch(e) {
        // alert("Error placing placeholder: " + e);
        return false;
    }
}

function convertToPoints(value) {
    // This is a simplification. In a real script we might check doc.viewPreferences.
    // But often geometricBounds respects the current ruler units.
    // If the document is in mm, value is in mm.
    // 1 inch = 25.4 mm = 72 points.
    // 1 mm = 2.83465 points.
    
    // Let's try to detect the unit or just assume the user is using something standard.
    // A safer way is to use the unit conversion method if available, or just check the preferences.
    
    var unit = app.activeDocument.viewPreferences.horizontalMeasurementUnits;
    
    switch(unit) {
        case MeasurementUnits.INCHES:
        case MeasurementUnits.INCHES_DECIMAL:
            return value * 72;
        case MeasurementUnits.MILLIMETERS:
            return value * 2.83465;
        case MeasurementUnits.CENTIMETERS:
            return value * 28.3465;
        case MeasurementUnits.POINTS:
            return value;
        case MeasurementUnits.PICAS:
            return value * 12;
        default:
            return value; // Assume points or pixels
    }
}

function createLabelFrame(page, parentItem) {
    try {
        var bounds = parentItem.geometricBounds;
        var labelFrame = page.textFrames.add();
        labelFrame.geometricBounds = bounds;
        labelFrame.contents = parentItem.name + " (Image)";
        labelFrame.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;
        labelFrame.paragraphs[0].justification = Justification.CENTER_ALIGN;
        
        // Optional: Set fill color to make it visible if image is there?
        // labelFrame.fillColor = "Paper"; 
        // labelFrame.transparencySettings.blendingSettings.opacity = 50;
    } catch(e) {
        // ignore
    }
}

main(typeof arguments !== "undefined" ? arguments : []);
