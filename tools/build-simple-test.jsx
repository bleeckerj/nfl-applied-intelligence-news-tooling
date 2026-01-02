// tools/build-simple-test.jsx
// Run this script from Adobe InDesign

function main() {
    // 1. Define the Test Data (Hardcoded for simplicity)
    var data = {
        headline: "AUTOMATION SUCCESSFUL",
        story: "This text was injected programmatically.\r\rIf you are reading this, the script successfully found the text frame named 'STORY_1' and replaced its content.\r\rThis proves that the 'Reserved Seat' method works."
    };

    // 2. Open the Template
    // We look for NewsTest_01.indt in the templates folder relative to this script
    var scriptFile = new File($.fileName);
    var projectRoot = scriptFile.parent.parent; 
    var templateFile = new File(projectRoot + "/templates/NewsTest_01.indt");
    
    if (!templateFile.exists) {
        // Fallback: Ask user to find it if we can't auto-detect
        templateFile = File.openDialog("Select your NewsTest_01.indt file");
    }

    if (!templateFile) return;

    var doc = app.open(templateFile);

    // 3. The "Reserved Seat" Logic
    // We look for frames by name and fill them.
    
    try {
        // Fill Headline
        var headFrame = doc.textFrames.item("HEADLINE_1");
        if (headFrame.isValid) {
            headFrame.contents = data.headline;
        } else {
            alert("Could not find a text frame named 'HEADLINE_1'.\rCheck your Layers panel.");
        }

        // Fill Story
        var storyFrame = doc.textFrames.item("STORY_1");
        if (storyFrame.isValid) {
            storyFrame.contents = data.story;
        } else {
            alert("Could not find a text frame named 'STORY_1'.\rCheck your Layers panel.");
        }

    } catch(e) {
        alert("Error: " + e.message);
    }
}

main();
