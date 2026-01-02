// tools/build-image-test.jsx
// Run this script from Adobe InDesign

function main() {
    // 1. Define Data
    var data = {
        headline: "Semi-autonomous Image and Text Injection Successful",
        body: "This text was injected into the frame named 'TEXT_1'.\r\rWe have successfully combined:\r1. Text Substitution (Headline)\r2. Body Text Injection\r3. Image Placement\r4. PDF Export\r\rThis completes the automation loop. But the other thing to consider is how images are handled.\r\rIf you see an image above, the script successfully found the graphic frame named 'IMAGE_1' and placed your selected image into it, fitting it proportionally. When we bundle for InDesign, we ensure all images are local paths so InDesign can access them without issues. We also want text of different styles to be applied correctly. For example, here is italics: This is italic text.\r\rAutomation is powerful! I am not sure that that previous text would be made italics just by saying it is italics. In order to do that, we would need to apply a character style in InDesign after placing the text. But there muswt be a way to do that programmatically as well. For example, Markdown parsing could help us identify such styles in the source data.",
        // In a real scenario, this path comes from your JSON
        imagePath: null 
    };

    // 2. Open Template
    var scriptFile = new File($.fileName);
    var projectRoot = scriptFile.parent.parent; 
    var templateFile = new File(projectRoot + "/templates/NewsTest_01.indt");
    
    if (!templateFile.exists) {
        templateFile = File.openDialog("Select your NewsTest_01.indt file");
    }
    if (!templateFile) return;

    // Recalculate projectRoot based on the actual template location
    // This ensures output goes to the project folder, not the InDesign Scripts folder
    projectRoot = templateFile.parent.parent;

    var doc = app.open(templateFile);

    // 3. Ask user for a test image
    var imageFile = File.openDialog("Select a test image (JPG/PNG)");
    if (!imageFile) {
        alert("No image selected. Skipping image test.");
    }

    // 4. The "Reserved Seat" Logic for Images
    try {
        // Fill Headline
        var headFrame = doc.textFrames.item("HEADLINE_1");
        if (headFrame.isValid) headFrame.contents = data.headline;

        // Fill Body Text (TEXT_1)
        var bodyFrame = doc.textFrames.item("TEXT_1");
        if (bodyFrame.isValid) {
            bodyFrame.contents = data.body;
        } else {
            alert("Could not find a text frame named 'TEXT_1'.\rPlease add it to your template.");
        }

        // Fill Image
        // We look for a "Rectangle" (Graphic Frame) named "IMAGE_1"
        var imgFrame = doc.rectangles.item("IMAGE_1");
        
        if (imgFrame.isValid && imageFile) {
            // A. Place the file
            imgFrame.place(imageFile);
            
            // B. Fit the image to the frame
            // Options: CENTER_CONTENT, CONTENT_TO_FRAME, FILL_PROPORTIONALLY, PROPORTIONALLY
            imgFrame.fit(FitOptions.FILL_PROPORTIONALLY);
            imgFrame.fit(FitOptions.CENTER_CONTENT);
            
        } else if (imageFile) {
            alert("Could not find a graphic frame named 'IMAGE_1'.\rCheck your Layers panel.");
        }

        // 5. Export PDF
        var distFolder = new Folder(projectRoot + "/dist");
        if (!distFolder.exists) distFolder.create();
        
        var pdfFile = new File(distFolder + "/NewsTest_Output.pdf");
        
        // Export using "High Quality Print" preset
        // ExportFormat.PDF_TYPE is for Print PDF
        doc.exportFile(ExportFormat.PDF_TYPE, pdfFile, false, "[High Quality Print]");
        
        alert("Success!\rPDF exported to: " + pdfFile.fsName);

    } catch(e) {
        alert("Error: " + e.message);
    }
}

main();
