// tools/export-layout-map.jsx
// Run this script from Adobe InDesign to export a JSON map of the current document.

function main() {
    if (app.documents.length === 0) {
        alert("Please open a document first.");
        return;
    }

    var doc = app.activeDocument;
    var layoutMap = {
        documentName: doc.name,
        pageWidth: doc.documentPreferences.pageWidth,
        pageHeight: doc.documentPreferences.pageHeight,
        pages: []
    };

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
            
            // Skip items on master pages if they appear in the list (usually allPageItems includes them if overridden)
            // But page.allPageItems usually gets items on the page.
            
            var itemData = {
                id: item.id,
                name: item.name,
                type: getItemType(item),
                bounds: item.geometricBounds, // [y1, x1, y2, x2]
                label: item.label,
                contentType: item.contentType.toString()
            };

            if (item instanceof TextFrame) {
                itemData.content = item.contents;
                // Try to get paragraph style of the first paragraph
                if (item.paragraphs.length > 0) {
                    itemData.paragraphStyle = item.paragraphs[0].appliedParagraphStyle.name;
                }
                // Check for threading
                if (item.nextTextFrame) itemData.nextTextFrameId = item.nextTextFrame.id;
                if (item.previousTextFrame) itemData.previousTextFrameId = item.previousTextFrame.id;
            }

            pageData.items.push(itemData);
        }
        layoutMap.pages.push(pageData);
    }

    // Save to file
    var scriptFile = new File($.fileName);
    var defaultFolder = scriptFile.parent.parent; // Project root
    var outputFile = File.saveDialog("Save Layout Map JSON", "*.json");
    
    if (outputFile) {
        outputFile.open("w");
        outputFile.write(JSON_stringify(layoutMap));
        outputFile.close();
        alert("Layout map exported to " + outputFile.fsName);
    }
}

function getItemType(item) {
    try {
        return item.constructor.name;
    } catch(e) {
        return "Unknown";
    }
}

// Simple JSON stringifier for ExtendScript
function JSON_stringify(obj) {
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
            else if (t == "object" && v !== null) v = JSON_stringify(v);
            json.push((arr ? "" : '"' + n + '":') + String(v));
        }
        return (arr ? "[" : "{") + String(json) + (arr ? "]" : "}");
    }
}

main();
