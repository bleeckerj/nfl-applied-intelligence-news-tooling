// tools/make-rich-flatplan.jsx
// Run this script from Adobe InDesign.
// Creates a "colorful" flatplan that KEEPS actual images but adds visible labels
// overlaying each frame showing the frame name/ID for reference.
// 
// Unlike make-flatplan.jsx which replaces content with FPO placeholders,
// this version preserves actual content while adding transparent label overlays.
//
// Use this on a COPY of your document to create a reference flatplan.

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
    // Strip extension if present
    docName = docName.replace(/\.[^\.]+$/, "");
    
    var originalInteractionLevel = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

    // Create or get a label color
    var labelColor;
    try {
        labelColor = doc.colors.itemByName("FlatplanLabel");
        if (!labelColor.isValid) {
            labelColor = doc.colors.add({name: "FlatplanLabel", colorValue: [0, 0, 0, 80]});
        }
    } catch(e) {
        labelColor = doc.colors.add({name: "FlatplanLabel", colorValue: [0, 0, 0, 80]});
    }

    // Create a contrasting text color
    var labelTextColor;
    try {
        labelTextColor = doc.colors.itemByName("FlatplanLabelText");
        if (!labelTextColor.isValid) {
            labelTextColor = doc.colors.add({name: "FlatplanLabelText", colorValue: [0, 0, 0, 0]});
        }
    } catch(e) {
        labelTextColor = doc.colors.add({name: "FlatplanLabelText", colorValue: [0, 0, 0, 0]});
    }

    try {
        for (var i = 0; i < doc.pages.length; i++) {
            var page = doc.pages[i];
            var pageItems = page.allPageItems;
            var labelsToAdd = [];

            for (var j = 0; j < pageItems.length; j++) {
                var item = pageItems[j];
                
                if (!item.isValid) continue;

                try {
                    // Generate a name if missing
                    if (!item.name || item.name === "") {
                        var typePrefix = "Obj";
                        if (item instanceof TextFrame) typePrefix = "TF";
                        else if (item instanceof Rectangle) typePrefix = "Img";
                        else if (item instanceof Oval) typePrefix = "Oval";
                        else if (item instanceof Polygon) typePrefix = "Poly";
                        item.name = typePrefix + "_P" + page.name + "_" + (j + 1);
                    }

                    // Collect info for label overlay
                    var bounds = item.geometricBounds; // [y1, x1, y2, x2]
                    var itemInfo = {
                        name: item.name,
                        bounds: bounds,
                        isText: (item instanceof TextFrame),
                        isGraphic: (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon)
                    };

                    // Get additional info
                    if (item instanceof TextFrame && item.paragraphs.length > 0) {
                        itemInfo.styleName = item.paragraphs[0].appliedParagraphStyle.name;
                    }
                    
                    // Check if it's an image frame with content
                    if (itemInfo.isGraphic) {
                        try {
                            if (item.allGraphics.length > 0) {
                                var graphic = item.allGraphics[0];
                                if (graphic.itemLink && graphic.itemLink.isValid) {
                                    itemInfo.linkedFile = graphic.itemLink.name;
                                }
                            }
                        } catch(e) {}
                    }

                    labelsToAdd.push(itemInfo);
                    
                } catch(e) {
                    $.writeln("Error processing item " + j + ": " + e);
                }
            }

            // Now add label overlays for each item
            // We do this in a separate pass to avoid modifying the collection while iterating
            for (var k = 0; k < labelsToAdd.length; k++) {
                var info = labelsToAdd[k];
                createLabelOverlay(page, info, labelColor, labelTextColor);
            }
        }
    } catch(e) {
        alert("Error creating rich flatplan: " + e);
    } finally {
        app.scriptPreferences.userInteractionLevel = originalInteractionLevel;
    }

    // Export to PDF
    try {
        var scriptFile = new File($.fileName);
        var projectFolder = scriptFile.parent.parent;
        
        var pdfFile = new File(projectFolder.fsName + "/" + docName + "_rich-flatplan.pdf");
        
        // Use High Quality Print for better image rendering
        var pdfPreset = app.pdfExportPresets.item("[High Quality Print]");
        if (!pdfPreset.isValid) {
            pdfPreset = app.pdfExportPresets.item("[Smallest File Size]");
        }
        
        if (pdfPreset.isValid) {
            doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false, pdfPreset);
            alert("Rich flatplan created and exported to:\n" + pdfFile.fsName);
        } else {
            doc.exportFile(ExportFormat.PDF_TYPE, pdfFile);
            alert("Rich flatplan created and exported to:\n" + pdfFile.fsName);
        }
    } catch(e) {
        alert("Rich flatplan created, but PDF export failed: " + e);
    }
}

/**
 * Create a semi-transparent label overlay on top of an item
 */
function createLabelOverlay(page, itemInfo, bgColor, textColor) {
    try {
        var bounds = itemInfo.bounds;
        var width = bounds[3] - bounds[1];
        var height = bounds[2] - bounds[0];
        
        // Determine label size - smaller for small frames
        var labelHeight = Math.min(24, height * 0.3, 20);
        var fontSize = Math.min(9, labelHeight * 0.5);
        if (fontSize < 5) fontSize = 5;
        
        // Position label at top of frame
        var labelBounds = [
            bounds[0], // y1 - top
            bounds[1], // x1 - left
            bounds[0] + labelHeight, // y2 - bottom
            bounds[3]  // x2 - right
        ];
        
        // Create the label background
        var labelFrame = page.textFrames.add();
        labelFrame.geometricBounds = labelBounds;
        
        // Build label text
        var labelText = itemInfo.name;
        if (itemInfo.styleName) {
            labelText += " [" + itemInfo.styleName + "]";
        }
        if (itemInfo.linkedFile) {
            labelText += " → " + itemInfo.linkedFile;
        }
        
        labelFrame.contents = labelText;
        
        // Style the label
        labelFrame.fillColor = bgColor;
        labelFrame.fillTint = 80;
        labelFrame.strokeWeight = 0;
        
        // Style the text
        if (labelFrame.paragraphs.length > 0) {
            var para = labelFrame.paragraphs[0];
            para.fillColor = textColor;
            para.pointSize = fontSize;
            para.justification = Justification.LEFT_ALIGN;
            
            // Try to use a bold sans-serif font
            try {
                para.appliedFont = app.fonts.itemByName("Helvetica Bold");
                if (!para.appliedFont.isValid) {
                    para.appliedFont = app.fonts.itemByName("Arial Bold");
                }
            } catch(e) {}
        }
        
        // Text frame settings
        labelFrame.textFramePreferences.verticalJustification = VerticalJustification.CENTER_ALIGN;
        labelFrame.textFramePreferences.insetSpacing = [2, 4, 2, 4];
        labelFrame.textFramePreferences.autoSizingReferencePoint = AutoSizingReferenceEnum.TOP_LEFT_POINT;
        
        // Bring to front
        labelFrame.bringToFront();
        
        // Name the label frame
        labelFrame.name = "LABEL_" + itemInfo.name;
        
    } catch(e) {
        $.writeln("Error creating label overlay: " + e);
    }
}

main(typeof arguments !== "undefined" ? arguments : []);
