// tools/ingest-assignments.jsx
// Canonical InDesign ingestion script for assignment schema v2.0.
// Includes adapter support for legacy pages[].assignments format.

function isObject(value) {
    return value && typeof value === "object" && !(value instanceof Array);
}

function firstJsonArg(args) {
    for (var i = 0; i < args.length; i++) {
        if (String(args[i]).match(/\.json$/i)) {
            return String(args[i]);
        }
    }
    return null;
}

function hasArg(args, key) {
    var marker = key + "=";
    for (var i = 0; i < args.length; i++) {
        var value = String(args[i]);
        if (value === key || value === marker + "true") {
            return true;
        }
        if (value === marker + "false") {
            return false;
        }
    }
    return null;
}

function adaptLegacyAssignments(input) {
    var pages = [];

    for (var i = 0; i < input.pages.length; i++) {
        var legacyPage = input.pages[i];
        var assignments = legacyPage.assignments || {};
        var slots = [];

        for (var name in assignments) {
            if (!assignments.hasOwnProperty(name)) continue;

            var item = assignments[name] || {};
            if (item.src || item.image_path) {
                slots.push({
                    name: name,
                    kind: "image",
                    src: item.src || item.image_path,
                    caption: item.caption,
                    fit: item.fit || "fill_proportionally"
                });
            } else {
                slots.push({
                    name: name,
                    kind: "text",
                    text: (item.content !== undefined) ? String(item.content) : "",
                    style: item.style
                });
            }
        }

        pages.push({
            id: legacyPage.id || legacyPage.name || ("p" + (i + 1)),
            slots: slots
        });
    }

    return {
        schema_version: "2.0",
        artifact_type: "newspaper",
        template_id: (input.metadata && (input.metadata.templateName || input.metadata.documentName)) || "legacy_template",
        output_mode: "deck",
        metadata: {
            adapted_from_legacy: true,
            source_generated_at: input.metadata ? input.metadata.generatedAt : ""
        },
        pages: pages
    };
}

function parseAssignmentData(raw) {
    if (!isObject(raw)) {
        throw new Error("Assignment JSON must be an object.");
    }

    if (raw.schema_version === "2.0") {
        return raw;
    }

    if (raw.pages && raw.pages.length > 0 && raw.pages[0].assignments) {
        return adaptLegacyAssignments(raw);
    }

    throw new Error("Unsupported assignment format. Expected schema v2.0 or legacy pages[].assignments.");
}

function findAssignmentFile(doc, args) {
    var explicitJsonPath = firstJsonArg(args);
    if (explicitJsonPath) {
        var explicitFile = new File(explicitJsonPath);
        if (explicitFile.exists) return explicitFile;
    }

    var projectRoot = new File($.fileName).parent.parent;

    var baseName = doc.name.replace(/\.[^\.]+$/, "");
    var rootCandidate = new File(projectRoot.fsName + "/" + baseName + "_assignments.json");
    if (rootCandidate.exists) return rootCandidate;

    try {
        if (doc.saved) {
            var localCandidate = new File(doc.filePath.fsName + "/" + baseName + "_assignments.json");
            if (localCandidate.exists) return localCandidate;
        }
    } catch (e) {}

    return File.openDialog("Select the Assignments JSON file", "*.json");
}

function readJsonFile(file) {
    file.open("r");
    file.encoding = "UTF-8";
    var content = file.read();
    file.close();

    try {
        return eval("(" + content + ")");
    } catch (e) {
        throw new Error("Error parsing JSON: " + e);
    }
}

function normalizePageName(id) {
    if (!id) return "";
    var raw = String(id);
    var match = raw.match(/^p(\d+)$/i);
    if (match) return match[1];
    return raw;
}

function findPage(doc, pageData, fallbackIndex, allowCreate, duplicateFromFirstPage) {
    var pageName = normalizePageName(pageData.id || pageData.name || "");

    if (pageName) {
        try {
            var byName = doc.pages.itemByName(pageName);
            if (byName && byName.isValid) return byName;
        } catch (e) {}
    }

    if (pageData.index !== undefined && pageData.index !== null) {
        var explicitIndex = parseInt(pageData.index, 10);
        if (!isNaN(explicitIndex) && explicitIndex >= 0 && explicitIndex < doc.pages.length) {
            return doc.pages[explicitIndex];
        }
    }

    if (fallbackIndex >= 0) {
        if (fallbackIndex < doc.pages.length) {
            return doc.pages[fallbackIndex];
        }

        if (allowCreate) {
            while (doc.pages.length <= fallbackIndex) {
                if (duplicateFromFirstPage && doc.pages.length > 0) {
                    doc.pages[0].duplicate(LocationOptions.AT_END);
                } else {
                    doc.pages.add(LocationOptions.AT_END);
                }
            }
            return doc.pages[fallbackIndex];
        }
    }

    return null;
}

function findItemOnPage(page, slotName) {
    var item = page.pageItems.itemByName(slotName);
    if (item && item.isValid) return item;
    return null;
}

function findItemsByNameOnPage(page, slotName) {
    var matches = [];
    try {
        var all = page.allPageItems;
        for (var i = 0; i < all.length; i++) {
            var item = all[i];
            if (!item || !item.isValid) continue;
            if (item.name === slotName) matches.push(item);
        }
    } catch (e) {}
    return matches;
}

function getItemTypeName(item) {
    try {
        if (item && item.constructor && item.constructor.name) return item.constructor.name;
    } catch (e) {}
    return "Unknown";
}

function isTextLike(item) {
    if (!item || !item.isValid) return false;
    try {
        // TextFrame is the common case; TextPath and other text containers expose "contents".
        if (item instanceof TextFrame) return true;
    } catch (e) {}

    try {
        if (typeof item.contents !== "undefined" && typeof item.parentStory !== "undefined") {
            return true;
        }
    } catch (e2) {}

    return false;
}

function findDescendantTextLike(item) {
    if (!item || !item.isValid) return null;
    if (isTextLike(item)) return item;

    try {
        var children = item.allPageItems;
        if (children && children.length > 0) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (!child || !child.isValid) continue;
                if (isTextLike(child)) return child;

                var nested = findDescendantTextLike(child);
                if (nested) return nested;
            }
        }
    } catch (e) {}

    return null;
}

function findDescendantGraphicFrame(item) {
    if (!item || !item.isValid) return null;
    try {
        if (item instanceof Rectangle || item instanceof Oval || item instanceof Polygon) return item;
    } catch (e) {}

    try {
        var children = item.allPageItems;
        if (children && children.length > 0) {
            for (var i = 0; i < children.length; i++) {
                var child = children[i];
                if (!child || !child.isValid) continue;
                try {
                    if (child instanceof Rectangle || child instanceof Oval || child instanceof Polygon) return child;
                } catch (e2) {}

                var nested = findDescendantGraphicFrame(child);
                if (nested) return nested;
            }
        }
    } catch (e3) {}

    return null;
}

function resolveTextTarget(item) {
    return findDescendantTextLike(item);
}

function resolveImageTarget(item) {
    return findDescendantGraphicFrame(item);
}

function resolveImageFile(src, assignmentRootFolder) {
    if (!src) return null;

    if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) {
        try {
            var filename = src.split("/").pop().split("?")[0];
            if (!filename) filename = "downloaded-image.jpg";

            var targetPath = Folder.temp.fsName + "/" + new Date().getTime() + "_" + filename;
            var curlCmd = "curl -L -s '" + src + "' -o '" + targetPath + "'";
            var appleScript = 'do shell script "' + curlCmd + '"';
            app.doScript(appleScript, ScriptLanguage.APPLESCRIPT_LANGUAGE);

            var downloaded = new File(targetPath);
            if (downloaded.exists) return downloaded;
            return null;
        } catch (e) {
            return null;
        }
    }

    var absolute = new File(src);
    if (absolute.exists) return absolute;

    var relative = new File(assignmentRootFolder.fsName + "/" + src);
    if (relative.exists) return relative;

    return null;
}

function applyTextSlot(item, slot, doc, warnings) {
    var target = resolveTextTarget(item);
    if (!target) {
        warnings.push("Slot " + slot.name + " is text, but resolved item type is " + getItemTypeName(item) + " (no text container found).");
        return;
    }

    target.contents = (slot.text !== undefined && slot.text !== null) ? String(slot.text) : "";

    if (slot.style) {
        try {
            var style = doc.paragraphStyles.itemByName(slot.style);
            if (style && style.isValid) {
                target.paragraphs.everyItem().applyParagraphStyle(style, true);
            } else {
                warnings.push("Paragraph style not found: " + slot.style + " (slot " + slot.name + ")");
            }
        } catch (e) {
            warnings.push("Failed applying style " + slot.style + " to slot " + slot.name + ": " + e);
        }
    }
}

function applyImageFit(item, fitSetting) {
    var fit = (fitSetting || "fill_proportionally").toLowerCase();

    try {
        if (fit === "content_to_frame") {
            item.fit(FitOptions.CONTENT_TO_FRAME);
        } else if (fit === "proportionally") {
            item.fit(FitOptions.PROPORTIONALLY);
            item.fit(FitOptions.CENTER_CONTENT);
        } else if (fit === "center_content") {
            item.fit(FitOptions.CENTER_CONTENT);
        } else {
            item.fit(FitOptions.FILL_PROPORTIONALLY);
            item.fit(FitOptions.CENTER_CONTENT);
        }
    } catch (e) {}
}

function applyImageSlot(item, slot, assignmentRootFolder, warnings) {
    var target = resolveImageTarget(item);
    if (!target) {
        warnings.push("Slot " + slot.name + " is image, but frame is not a graphic frame.");
        return;
    }

    if (!slot.src || slot.src === "images/placeholder.jpg") {
        if (slot.required) {
            warnings.push("Required image slot missing source: " + slot.name);
        }
        return;
    }

    var fileToPlace = resolveImageFile(slot.src, assignmentRootFolder);
    if (!fileToPlace || !fileToPlace.exists) {
        warnings.push("Image not found for slot " + slot.name + ": " + slot.src);
        return;
    }

    try {
        target.place(fileToPlace);
        applyImageFit(target, slot.fit);
    } catch (e) {
        warnings.push("Failed to place image for slot " + slot.name + ": " + e);
    }
}

function applySlot(item, slot, doc, assignmentRootFolder, warnings) {
    if (slot.kind === "text") {
        applyTextSlot(item, slot, doc, warnings);
        return;
    }

    if (slot.kind === "image") {
        applyImageSlot(item, slot, assignmentRootFolder, warnings);
        return;
    }

    warnings.push("Unknown slot kind for " + slot.name + ": " + slot.kind);
}

function resolveItemForSlot(page, slot) {
    var namedItems = findItemsByNameOnPage(page, slot.name);
    if (namedItems.length === 0) return null;

    // Prefer a direct type match to avoid itemByName returning an unrelated object with same name.
    for (var i = 0; i < namedItems.length; i++) {
        var candidate = namedItems[i];
        if (slot.kind === "text" && resolveTextTarget(candidate)) return candidate;
        if (slot.kind === "image" && resolveImageTarget(candidate)) return candidate;
    }

    // Fallback to first named item.
    return namedItems[0];
}

function main(args) {
    if (app.documents.length === 0) {
        alert("Please open the target template/document first.");
        return;
    }

    var doc = app.activeDocument;
    var strictFlag = hasArg(args, "strict");
    var strict = (strictFlag === null) ? true : Boolean(strictFlag);

    var assignmentFile = findAssignmentFile(doc, args);
    if (!assignmentFile) return;

    var rawData = readJsonFile(assignmentFile);
    var data = parseAssignmentData(rawData);

    var errors = [];
    var warnings = [];

    var originalInteraction = app.scriptPreferences.userInteractionLevel;
    app.scriptPreferences.userInteractionLevel = UserInteractionLevels.NEVER_INTERACT;

    try {
        if (!data.pages || data.pages.length === 0) {
            throw new Error("Assignment document has no pages.");
        }

        var assignmentRootFolder = assignmentFile.parent;

        var createPages = (data.artifact_type === "cards" && data.output_mode === "deck");
        var duplicateFromFirstPage = createPages;

        for (var i = 0; i < data.pages.length; i++) {
            var pageData = data.pages[i];
            var page = findPage(doc, pageData, i, createPages, duplicateFromFirstPage);

            if (!page || !page.isValid) {
                errors.push("Could not resolve page for assignment page id: " + pageData.id);
                continue;
            }

            var slots = pageData.slots || [];
            for (var j = 0; j < slots.length; j++) {
                var slot = slots[j];
                if (!slot || !slot.name) {
                    errors.push("Invalid slot definition on page " + pageData.id + " at index " + j);
                    continue;
                }

                var item = resolveItemForSlot(page, slot);
                if (!item) {
                    var msg = "Named slot not found on page " + page.name + ": " + slot.name;
                    if (strict) {
                        errors.push(msg);
                    } else {
                        warnings.push(msg);
                    }
                    continue;
                }

                applySlot(item, slot, doc, assignmentRootFolder, warnings);
            }
        }
    } catch (e) {
        errors.push(String(e));
    } finally {
        app.scriptPreferences.userInteractionLevel = originalInteraction;
    }

    if (errors.length > 0) {
        alert("Ingest failed with " + errors.length + " error(s).\n\n" + errors.slice(0, 10).join("\n"));
        return;
    }

    var summary = "Ingest complete.";
    if (warnings.length > 0) {
        summary += "\nWarnings: " + warnings.length + "\n" + warnings.slice(0, 10).join("\n");
    }

    alert(summary);
}

main(typeof arguments !== "undefined" ? arguments : []);
