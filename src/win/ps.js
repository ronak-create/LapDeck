// Single choke-point for running PowerShell snippets from the agent.
import { execFile } from "node:child_process";

// Runs a PowerShell -Command snippet, resolving with trimmed stdout.
// Rejects with { message } on nonzero exit (except callers that tolerate it).
export function runPS(script, { timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { timeout, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "PowerShell error").toString().trim();
          reject(new Error(msg.split("\n")[0] || "PowerShell error"));
          return;
        }
        resolve((stdout || "").toString().trim());
      }
    );
  });
}
