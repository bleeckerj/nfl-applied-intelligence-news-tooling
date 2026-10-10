import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

function parseArgs(argv) {
  const parsed = {
    scriptPath: null,
    filePath: null,
    scriptArgs: [],
    includeFileBasenameArg: true,
    timeoutSeconds: 600,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg.startsWith("--script=")) {
      parsed.scriptPath = arg.slice("--script=".length);
    } else if (arg === "--script") {
      parsed.scriptPath = argv[++index];
    } else if (arg.startsWith("--file=")) {
      parsed.filePath = arg.slice("--file=".length);
    } else if (arg === "--file") {
      parsed.filePath = argv[++index];
    } else if (arg.startsWith("--arg=")) {
      parsed.scriptArgs.push(arg.slice("--arg=".length));
    } else if (arg === "--arg") {
      parsed.scriptArgs.push(argv[++index]);
    } else if (arg === "--no-file-basename-arg") {
      parsed.includeFileBasenameArg = false;
    } else if (arg === "--timeout") {
      parsed.timeoutSeconds = Number(argv[++index] || 600);
    } else if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    }
  }

  return parsed;
}

function printUsage() {
  console.log(`Usage: node tools/run-id-script.mjs --script <path> [--file <path>] [--arg <value> ...]

Options:
  --script <path>                JSX script to run inside InDesign (required)
  --file <path>                  Optional document/template to open first
  --arg <value>                  Additional argument passed to JSX (repeatable)
  --no-file-basename-arg         Do not prepend opened filename to JSX args
  --timeout <seconds>            Script execution timeout (default: 600)
`);
}

function resolveExistingPath(value, label) {
  const resolved = path.resolve(process.cwd(), value);
  if (!fs.existsSync(resolved)) {
    throw new Error(`${label} not found: ${resolved}`);
  }
  return resolved;
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildAppleScript({ scriptPath, filePath, args, timeoutSeconds }) {
  const escapedScriptPath = escapeAppleScriptString(scriptPath);
  const hasFile = Boolean(filePath);
  const escapedFilePath = hasFile ? escapeAppleScriptString(filePath) : "";

  const escapedArgs = args.map((arg) => `"${escapeAppleScriptString(arg)}"`);
  const argClause = escapedArgs.length > 0 ? ` with arguments {${escapedArgs.join(", ")}}` : "";

  const lines = [
    'tell application id "com.adobe.InDesign"',
    "    activate",
  ];

  if (hasFile) {
    lines.push(`    open POSIX file \"${escapedFilePath}\"`);
  }

  lines.push(`    set myScript to POSIX file \"${escapedScriptPath}\"`);
  lines.push(`    with timeout of ${Math.max(1, Number(timeoutSeconds) || 600)} seconds`);
  lines.push(`        do script myScript language javascript${argClause}`);
  lines.push("    end timeout");
  lines.push("end tell");

  return lines.join("\n");
}

function runAppleScript(scriptText) {
  return new Promise((resolve, reject) => {
    const child = spawn("osascript", ["-e", scriptText], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || `osascript failed with exit code ${code}`));
      }
    });
  });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printUsage();
    return;
  }

  if (!parsed.scriptPath) {
    printUsage();
    throw new Error("--script is required.");
  }

  const scriptPath = resolveExistingPath(parsed.scriptPath, "Script");
  const filePath = parsed.filePath ? resolveExistingPath(parsed.filePath, "File") : null;

  const args = [];
  if (filePath && parsed.includeFileBasenameArg) {
    args.push(path.basename(filePath));
  }
  args.push(...parsed.scriptArgs.filter((arg) => arg !== undefined));

  const appleScript = buildAppleScript({
    scriptPath,
    filePath,
    args,
    timeoutSeconds: parsed.timeoutSeconds,
  });

  console.log(`Script: ${scriptPath}`);
  if (filePath) console.log(`Target File: ${filePath}`);
  if (args.length > 0) console.log(`Script Args: ${args.join(", ")}`);
  console.log("Sending command to InDesign...");

  const { stdout, stderr } = await runAppleScript(appleScript);

  if (stdout && stdout.trim()) {
    console.log(stdout.trim());
  }
  if (stderr && stderr.trim()) {
    console.error(stderr.trim());
  }

  console.log("Script executed successfully.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
