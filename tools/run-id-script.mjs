import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse arguments
const args = process.argv.slice(2);
const fileArg = args.find(a => a.startsWith('--file='));
const scriptArg = args.find(a => a.startsWith('--script='));

if (!scriptArg) {
    console.error('Usage: node tools/run-id-script.mjs --script=<path> [--file=<path>]');
    process.exit(1);
}

const scriptPath = path.resolve(process.cwd(), scriptArg.split('=')[1]);
const filePath = fileArg ? path.resolve(process.cwd(), fileArg.split('=')[1]) : null;

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

if (filePath) {
    appleScript += `
    open POSIX file "${filePath}"
    `;
}

appleScript += `
    set myScript to POSIX file "${scriptPath}"
    do script myScript language javascript
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
