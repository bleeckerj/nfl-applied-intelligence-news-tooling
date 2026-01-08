#!/bin/bash
# tools/open-viewer.sh
# Opens the viewer in the default browser.

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
VIEWER_HTML="$SCRIPT_DIR/viewer/index.html"

if [ -f "$VIEWER_HTML" ]; then
    echo "Opening viewer..."
    open "$VIEWER_HTML"
else
    echo "Error: Viewer index.html not found at $VIEWER_HTML"
    exit 1
fi
