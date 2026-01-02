// tools/make-flatplan.jsx
// Run this script from Adobe InDesign.
// WARNING: This will OVERWRITE the content of text frames with their names/IDs.
// Use this on a COPY of your document to create a reference "flatplan".

function main() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    
    if (!confirm("This script will overwrite text content in this document to create a flatplan reference. \n\nAre you sure you want to proceed?")) {
        return;
    }

    var counter = 1;

    for (var i = 0; i < doc.pages.length; i++) {
        var page = doc.pages[i];
        var pageItems = page.allPageItems;

        for (var j = 0; j < pageItems.length; j++) {
            var item = pageItems[j];
            
            // Generate a name if missing
            if (!item.name || item.name === "") {
                var typePrefix = (item instanceof TextFrame) ? "TF" : "Obj";
                item.name = typePrefix + "_P" + page.name + "_" + (j + 1);
            }

            // If it's a text frame, set content to name
            if (item instanceof TextFrame) {
                // We only set content if it's not threaded or if it's the first in thread
                // actually, for a flatplan, we might want to label every box.
                // But if we change content of threaded frame, it flows.
                // So we should probably just prepend or replace.
                // Replacing is safest for a "map".
                
                try {
                    item.contents = item.name + "\n(" + getStyleName(item) + ")";
                } catch(e) {
                    // Ignore errors (e.g. locked, overset)
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
        }
    }

    alert("Flatplan created! Text frames now show their names.");
}

function getStyleName(textFrame) {
    if (textFrame.paragraphs.length > 0) {
        return textFrame.paragraphs[0].appliedParagraphStyle.name;
    }
    return "No Style";
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

main();
