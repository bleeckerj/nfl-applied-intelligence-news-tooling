// Dump named page items and their types to a JSON file next to the document.
function getItemType(item) {
    try { return item.constructor.name; } catch (e) { return "Unknown"; }
}

function main(args) {
    if (app.documents.length === 0) {
        alert("No document open.");
        return;
    }

    var doc = app.activeDocument;
    var rows = [];

    for (var p = 0; p < doc.pages.length; p++) {
        var page = doc.pages[p];
        var items = page.allPageItems;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || !it.isValid) continue;
            if (!it.name || it.name === "") continue;
            rows.push({
                page: page.name,
                name: it.name,
                type: getItemType(it),
                id: it.id
            });
        }
    }

    var outPath;
    try {
        var base = doc.name.replace(/\.[^\.]+$/, "");
        outPath = doc.filePath.fsName + "/" + base + "_named-items.json";
    } catch (e) {
        var scriptFile = new File($.fileName);
        outPath = scriptFile.parent.parent.fsName + "/named-items.json";
    }

    var outFile = new File(outPath);
    outFile.encoding = "UTF-8";
    outFile.open("w");
    outFile.write(JSON.stringify(rows, null, 2));
    outFile.close();

    if (args && args.length > 0) return outFile.fsName;
    alert("Wrote: " + outFile.fsName);
}

main(typeof arguments !== "undefined" ? arguments : []);
