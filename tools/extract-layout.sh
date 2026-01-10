#!/bin/bash
# tools/extract-layout.sh
# Usage: ./tools/extract-layout.sh path/to/document.indd [optional-output-dir]

INDD_FILE="$1"
OUTPUT_DIR="$2"

if [ -z "$INDD_FILE" ]; then
  echo "Usage: $0 <path-to-indesign-file> [optional-output-dir]"
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

# If output directory is specified, move the extraction result there
if [ -n "$OUTPUT_DIR" ]; then
  if [[ "$OUTPUT_DIR" == *.json ]]; then
      echo "Warning: Output argument '$OUTPUT_DIR' ends in .json."
      echo "This script interprets the second argument as a DIRECTORY, so a folder named '$OUTPUT_DIR' will be created/used."
  fi
  
  # Create directory if it doesn't exist
  mkdir -p "$OUTPUT_DIR"
  
  # Resolve absolute path for output directory
  ABS_OUTPUT_DIR=$(cd "$OUTPUT_DIR"; pwd)
  
  NEW_EXTRACTED_JSON="$ABS_OUTPUT_DIR/${FILENAME}_extracted.json"
  mv "$EXTRACTED_JSON" "$NEW_EXTRACTED_JSON"
  EXTRACTED_JSON="$NEW_EXTRACTED_JSON"
  DIRNAME="$ABS_OUTPUT_DIR"
  echo "Moved extraction result to: $EXTRACTED_JSON"
fi

echo "--- Step 2: Structuring content into articles ---"
node tools/structure-content.mjs "$EXTRACTED_JSON"

STRUCTURED_JSON="$DIRNAME/${FILENAME}_extracted_structured.json"

if [ -f "$STRUCTURED_JSON" ]; then
  echo "--- Success! ---"
  echo "Final structured content: $STRUCTURED_JSON"
  echo ""
  echo "To view this content, run:"
  echo "./tools/open-viewer.sh"
  echo "And drag the structured JSON file into the window."
else
  echo "Error: Structuring failed."
  exit 1
fi
