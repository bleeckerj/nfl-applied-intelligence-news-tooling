
var doc = app.activeDocument;
var tf = doc.textFrames[0]; // Just grab the first one
alert("Checking frame: " + tf.id);
try {
    if (tf.previousTextFrame == null) {
        alert("Previous is null");
    } else {
        alert("Previous is: " + tf.previousTextFrame.toString());
    }
} catch(e) {
    alert("Error accessing previous: " + e);
}
