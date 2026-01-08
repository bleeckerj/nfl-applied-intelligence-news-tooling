#!/bin/bash
# tools/extract-layout.sh
# Usage: ./tools/extract-layout.sh path/to/document.indd

INDD_FILE="$1"

if [ -z "$INDD_FILE" ]; then
  echo "Usage: $0 <path-to-indesign-file>"
  exit 1
fi

# Ensure absolute path for the file, as Node/InDesign need it
ABS_FILE_PATH=$(cd "$(dirname "$INDD_FILE")"; pwd)/$(basename "$INDD_FILE")

echo "--- Step 1: Extracting raw content from InDesign ---"
node tools/run-id-script.mjs --script tools/extract-content.jsx --file "$ABS_FILE_PATH"

# Determine the expected output file from step 1
# The script saves it as [filename_without_ext]_extracted.json in the same folder
FILENAME=$(basename "$INDD_FILE" .indd)
DIRNAME=$(dirname "$ABS_FILE_PATH")
EXTRACTED_JSON="$DIRNAME/${FILENAME}_extracted.json"

if [ ! -f "$EXTRACTED_JSON" ]; then
  echo "Error: Extraction failed. File not found: $EXTRACTED_JSON"
  exit 1
fi

echo "--- Step 2: Structuring content into articles ---"
node tools/structure-content.mjs "$EXTRACTED_JSON"

STRUCTURED_JSON="$DIRNAME/${FILENAME}_extracted_structured.json"

if [ -f "$STRUCTURED_JSON" ]; then
  echo "--- Success! ---"
  echo "Final structured content: $STRUCTURED_JSON"
else
  echo "Error: Structuring failed."
  exit 1
fi
