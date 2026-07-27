// Windows launcher: opens apps, folders, files and URLs via `cmd /c start`.
// `start` resolves App Paths (e.g. bare "chrome.exe"), detaches, and foregrounds
// the window (raw explorer.exe/execFile open behind other windows). The empty ""
// is the title slot `start` expects before the target.
import { execFile } from "node:child_process";

function start(target, args = []) {
  execFile("cmd", ["/c", "start", "", target, ...args], { windowsHide: true });
}

// Launch a launcher entry ({ kind, target, args, browser }).
export function launch(entry) {
  if (!entry) throw new Error("no such app");
  const { kind, target, args = [], browser } = entry;
  switch (kind) {
    case "exec":
      start(target, args);
      return;
    case "folder":
    case "file":
      start(target);
      return;
    case "url":
      // Optional `browser` forces a specific browser (resolved via App Paths),
      // e.g. "chrome" opens the URL in Chrome instead of the system default.
      if (browser) start(`${browser}.exe`, [target]);
      else start(target);
      return;
    default:
      throw new Error(`unknown app kind: ${kind}`);
  }
}

// Open a file or folder in Explorer, foregrounded (used by fs.open).
export function open(target) {
  start(target);
}
