// tools/build-newspaper.jsx
// Run this script from Adobe InDesign

function main() {
    // 1. Select Data File
    var dataFile = File.openDialog("Select the indesign-data.json file");
    if (!dataFile) return;

    dataFile.open("r");
    var jsonString = dataFile.read();
    dataFile.close();
    
    // Simple JSON parser for ExtendScript (which doesn't have JSON.parse built-in in older versions)
    var data = eval("(" + jsonString + ")");

    // 2. Select Template File
    // We try to find it automatically, otherwise ask user
    var scriptFile = new File($.fileName);
    var projectRoot = scriptFile.parent.parent; // Assuming tools/build-newspaper.jsx
    var templateFile = new File(projectRoot + "/templates/Newspaper_Template.indt");
    
    if (!templateFile.exists) {
        templateFile = File.openDialog("Select the Newspaper_Template.indt file");
    }
    
    if (!templateFile || !templateFile.exists) {
        alert("Template file not found!");
        return;
    }

    // 3. Create Document
    var doc = app.open(templateFile);
    
    // 4. Process Pages
    if (data.pages && data.pages.length > 0) {
        // We'll just do the first page for the pilot
        var pageData = data.pages[0];
        var page = doc.pages[0];
        
        layoutFrontPage(doc, page, pageData);
    }

    alert("Newspaper Pilot Build Complete!");
}

function layoutFrontPage(doc, page, data) {
    var margin = 12.7; // mm (0.5 in)
    var gutter = 4; // mm
    var pageWidth = doc.documentPreferences.pageWidth;
    var pageHeight = doc.documentPreferences.pageHeight;
    var contentWidth = pageWidth - (margin * 2);
    
    // Calculate Column Width (assuming 5 cols)
    var colCount = 5;
    var colWidth = (contentWidth - ((colCount - 1) * gutter)) / colCount;

    // --- Masthead ---
    // We assume the template might have a placeholder, or we draw it.
    // Let's draw it for now.
    var mastheadFrame = page.textFrames.add();
    mastheadFrame.geometricBounds = [margin, margin, margin + 25, margin + contentWidth];
    mastheadFrame.contents = data.masthead || "The Future Times";
    try { mastheadFrame.parentStory.appliedParagraphStyle = doc.paragraphStyles.item("Headline"); } catch(e) {}
    mastheadFrame.textFramePreferences.verticalJustification = VerticalJustification.BOTTOM_ALIGN;

    // --- Lead Story ---
    var startY = margin + 30;
    
    // Image Logic: "Find or Create"
    if (data.lead.image) {
        // 1. Try to find a "Reserved Seat" named "LEAD_IMAGE"
        var imgFrame = page.rectangles.item("LEAD_IMAGE");
        
        if (imgFrame.isValid) {
            // Found it! Use the fixed frame.
            // We don't change startY because the frame is already positioned in the template.
        } else {
            // 2. Not found? Create it dynamically ("Tetris" mode)
            var imgHeight = 60; // mm
            imgFrame = page.rectangles.add();
            imgFrame.geometricBounds = [startY, margin, startY + imgHeight, margin + (colWidth * 3) + (gutter * 2)];
            
            // Since we inserted a new object, we need to push the text down
            startY += imgHeight + gutter;
        }
        
        // Place and Fit
        try {
            imgFrame.place(File(data.lead.image));
            imgFrame.fit(FitOptions.FILL_PROPORTIONALLY); 
            imgFrame.fit(FitOptions.CENTER_CONTENT);      
        } catch(e) {
            // Image might be missing
        }
    }
    
    // Headline
    var headFrame = page.textFrames.add();
    headFrame.geometricBounds = [startY, margin, startY + 20, margin + (colWidth * 3) + (gutter * 2)];
    headFrame.contents = data.lead.headline;
    try { headFrame.parentStory.appliedParagraphStyle = doc.paragraphStyles.item("Headline"); } catch(e) {}

    // Body Text - Column 1
    var bodyY = startY + 25;
    var bodyFrame1 = page.textFrames.add();
    bodyFrame1.geometricBounds = [bodyY, margin, pageHeight - margin, margin + colWidth];
    bodyFrame1.contents = data.lead.body;
    try { bodyFrame1.parentStory.appliedParagraphStyle = doc.paragraphStyles.item("Body Text"); } catch(e) {}

    // Body Text - Column 2 (Threaded)
    var bodyFrame2 = page.textFrames.add();
    bodyFrame2.geometricBounds = [bodyY, margin + colWidth + gutter, pageHeight - margin, margin + (colWidth * 2) + gutter];
    
    // Link Frames
    bodyFrame1.nextTextFrame = bodyFrame2;
    
    // Body Text - Column 3 (Threaded)
    var bodyFrame3 = page.textFrames.add();
    bodyFrame3.geometricBounds = [bodyY, margin + (colWidth * 2) + (gutter * 2), pageHeight - margin, margin + (colWidth * 3) + (gutter * 2)];
    bodyFrame2.nextTextFrame = bodyFrame3;

    // --- Sidebar (Briefs) ---
    if (data.sidebar) {
        var sidebarX = margin + (colWidth * 3) + (gutter * 3);
        var sidebarFrame = page.textFrames.add();
        sidebarFrame.geometricBounds = [startY, sidebarX, pageHeight - margin, margin + contentWidth];
        
        // Apply Object Style if exists
        try { sidebarFrame.appliedObjectStyle = doc.objectStyles.item("Sidebar Box"); } catch(e) {}
        
        sidebarFrame.contents = data.sidebar.title.toUpperCase() + "\r";
        try { sidebarFrame.parentStory.paragraphs[0].appliedParagraphStyle = doc.paragraphStyles.item("Section Header"); } catch(e) {}
        
        for (var i = 0; i < data.sidebar.items.length; i++) {
            var item = data.sidebar.items[i];
            sidebarFrame.contents += item.headline + "\r";
            // Note: Applying styles to specific paragraphs in a loop is verbose in ExtendScript, 
            // skipping for brevity in this pilot, but fully possible.
            sidebarFrame.contents += item.body + "\r\r";
        }
    }
}

main();
