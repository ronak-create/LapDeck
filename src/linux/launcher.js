// Linux launcher: opens apps, folders, files and URLs. Folders/files/URLs go
// through `xdg-open` (the desktop's default handler); `exec` entries spawn the
// binary directly, detached so it outlives the agent. Mirrors win/launcher.js.
import { spawn } from "node:child_process";

// Spawn fully detached: new session, no stdio, unref'd so the agent can exit
// without killing the launched app.
function detach(cmd, args = []) {
  const child = spawn(cmd, args, { detached: true, stdio: "ignore" });
  child.on("error", () => {}); // missing binary shouldn't crash the agent
  child.unref();
}

function xdgOpen(target) {
  detach("xdg-open", [target]);
}

// Launch a launcher entry ({ kind, target, args, browser }).
export function launch(entry) {
  if (!entry) throw new Error("no such app");
  const { kind, target, args = [], browser } = entry;
  switch (kind) {
    case "exec":
      detach(target, args);
      return;
    case "folder":
    case "file":
      xdgOpen(target);
      return;
    case "url":
      // Optional `browser` forces a specific browser binary (e.g. google-chrome).
      if (browser) detach(browser, [target]);
      else xdgOpen(target);
      return;
    default:
      throw new Error(`unknown app kind: ${kind}`);
  }
}

// Open a file or folder in the desktop file manager / default handler.
export function open(target) {
  xdgOpen(target);
}
