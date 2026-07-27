// Single choke-point for running CLI tools from the Linux backends. Every helper
// here degrades to a human-readable error when its tool is missing (ENOENT) so a
// missing `pactl`/`brightnessctl`/`ydotool`/etc. reports cleanly instead of
// crashing the agent.
import { execFile } from "node:child_process";

// Runs `cmd args`, resolving trimmed stdout. Rejects with a one-line message on
// failure. `ignoreExit` resolves stdout even on a nonzero exit (some tools exit
// nonzero on benign conditions).
export function run(cmd, args = [], { timeout = 8000, ignoreExit = false } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const out = (stdout || "").toString().trim();
      if (err) {
        if (err.code === "ENOENT") {
          reject(new Error(`${cmd} not installed — see README Linux requirements`));
          return;
        }
        if (ignoreExit) { resolve(out); return; }
        const msg = (stderr || err.message || `${cmd} failed`).toString().trim();
        reject(new Error(msg.split("\n")[0] || `${cmd} failed`));
        return;
      }
      resolve(out);
    });
  });
}

// True if `cmd` is resolvable on PATH. Never throws.
export async function has(cmd) {
  try {
    await run("sh", ["-c", `command -v ${cmd} >/dev/null 2>&1`]);
    return true;
  } catch {
    return false;
  }
}
