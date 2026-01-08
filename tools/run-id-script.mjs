import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments manually to support both --arg=value and --arg value
const args = process.argv.slice(2);
let scriptPath = null;
let filePath = null;

for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--script=')) {
        scriptPath = arg.split('=')[1];
    } else if (arg === '--script') {
        if (i + 1 < args.length) {
            scriptPath = args[i + 1];
            i++; // Skip next arg
        }
    } else if (arg.startsWith('--file=')) {
        filePath = arg.split('=')[1];
    } else if (arg === '--file') {
        if (i + 1 < args.length) {
            filePath = args[i + 1];
            i++; // Skip next arg
        }
    }
}

if (!scriptPath) {
    console.error('Usage: node tools/run-id-script.mjs --script <path> [--file <path>]');
    process.exit(1);
}

// Resolve paths
scriptPath = path.resolve(process.cwd(), scriptPath);
if (filePath) {
    filePath = path.resolve(process.cwd(), filePath);
}

if (!fs.existsSync(scriptPath)) {
    console.error(`Script not found: ${scriptPath}`);
    process.exit(1);
}

if (filePath && !fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

console.log(`Script: ${scriptPath}`);
if (filePath) console.log(`Target File: ${filePath}`);

// Construct AppleScript
let appleScript = `
tell application id "com.adobe.InDesign"
    activate
`;

let scriptArgs = "";

if (filePath) {
    appleScript += `
    open POSIX file "${filePath}"
    `;
    
    // Pass the filename as an argument to the script
    const fileName = path.basename(filePath);
    scriptArgs = `with arguments {"${fileName}"}`;
}

appleScript += `
    set myScript to POSIX file "${scriptPath}"
    with timeout of 600 seconds
        do script myScript language javascript ${scriptArgs}
    end timeout
end tell
`;

// Execute AppleScript
const command = `osascript -e '${appleScript}'`;

console.log('Sending command to InDesign...');

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error(`Error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.error(`Stderr: ${stderr}`);
        return;
    }
    console.log('Script executed successfully.');
});
