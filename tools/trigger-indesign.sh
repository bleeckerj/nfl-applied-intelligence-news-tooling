#!/bin/bash

# tools/trigger-indesign.sh
# Usage: ./trigger-indesign.sh [script-name.jsx]
# Example: ./trigger-indesign.sh build-newspaper.jsx

SCRIPT_NAME=$1

if [ -z "$SCRIPT_NAME" ]; then
  echo "Usage: $0 <script-name.jsx>"
  echo "Available scripts in tools/:"
  ls *.jsx
  exit 1
fi

# Get absolute path to the script
SCRIPT_PATH="$(pwd)/$SCRIPT_NAME"

if [ ! -f "$SCRIPT_PATH" ]; then
  echo "Error: Script not found at $SCRIPT_PATH"
  exit 1
fi

echo "Triggering InDesign to run: $SCRIPT_NAME"

# Use AppleScript to tell InDesign to run the script
# We use 'id "com.adobe.InDesign"' to target the running InDesign instance regardless of version year
osascript <<EOF
tell application id "com.adobe.InDesign"
    activate
    set myScript to POSIX file "$SCRIPT_PATH"
    do script myScript language javascript
end tell
EOF

echo "Done."
