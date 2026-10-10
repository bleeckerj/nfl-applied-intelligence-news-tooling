// tools/export-pdf.jsx
// Export active InDesign document to PDF.

function parseArgs(args) {
    var outputPath = "";
    var presetName = "[High Quality Print]";

    for (var i = 0; i < args.length; i++) {
        var arg = args[i];

        if (!arg) continue;

        if (arg.match(/\.pdf$/i)) {
            outputPath = arg;
        } else if (arg.indexOf("preset=") === 0) {
            presetName = arg.substring("preset=".length);
        }
    }

    return {
        outputPath: outputPath,
        presetName: presetName
    };
}

function resolveOutputFile(doc, outputPath) {
    if (outputPath && outputPath.length > 0) {
        return new File(outputPath);
    }

    var baseName = doc.name.replace(/\.[^\.]+$/, "");

    try {
        return new File(doc.filePath.fsName + "/" + baseName + "_print.pdf");
    } catch (e) {
        var scriptFile = new File($.fileName);
        var fallbackFolder = scriptFile.parent.parent;
        return new File(fallbackFolder.fsName + "/" + baseName + "_print.pdf");
    }
}

function main(args) {
    if (app.documents.length === 0) {
        alert("No active InDesign document to export.");
        return;
    }

    var doc = app.activeDocument;
    var parsed = parseArgs(args || []);
    var outputFile = resolveOutputFile(doc, parsed.outputPath);

    var preset = null;
    try {
        preset = app.pdfExportPresets.item(parsed.presetName);
        if (!preset.isValid) {
            preset = null;
        }
    } catch (e) {
        preset = null;
    }

    try {
        // Force full-document export regardless of PDF preset page-range settings.
        app.pdfExportPreferences.pageRange = PageRange.ALL_PAGES;

        if (preset) {
            doc.exportFile(ExportFormat.PDF_TYPE, outputFile, false, preset);
        } else {
            doc.exportFile(ExportFormat.PDF_TYPE, outputFile);
        }

        if (args && args.length > 0) {
            return outputFile.fsName;
        }

        alert("PDF exported to: " + outputFile.fsName);
    } catch (e) {
        alert("Failed to export PDF: " + e);
    }
}

main(typeof arguments !== "undefined" ? arguments : []);
