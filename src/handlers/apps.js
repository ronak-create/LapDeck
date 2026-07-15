// Launcher: list/launch/add/remove entries from apps.json.
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import { loadApps, saveApps } from "../config.js";

function launchEntry(entry) {
  if (!entry) throw new Error("no such app");
  const { kind, target, args = [], browser } = entry;
  switch (kind) {
    case "exec":
      // `start` resolves App Paths (e.g. bare "chrome.exe") and detaches.
      execFile("cmd", ["/c", "start", "", target, ...args], { windowsHide: true });
      return;
    case "folder":
      // `start` opens the folder AND foregrounds it (raw explorer.exe opens
      // behind other windows when spawned from the agent). Empty "" = title slot.
      execFile("cmd", ["/c", "start", "", target], { windowsHide: true });
      return;
    case "file":
      execFile("cmd", ["/c", "start", "", target], { windowsHide: true });
      return;
    case "url":
      // Optional `browser` forces a specific browser (resolved via App Paths),
      // e.g. "chrome" opens the URL in Chrome instead of the system default.
      if (browser) {
        execFile("cmd", ["/c", "start", "", `${browser}.exe`, target], { windowsHide: true });
      } else {
        execFile("cmd", ["/c", "start", "", target], { windowsHide: true });
      }
      return;
    default:
      throw new Error(`unknown app kind: ${kind}`);
  }
}

export const apps = {
  "apps.list": async () => ({ apps: loadApps() }),

  "apps.launch": async ({ id }) => {
    const entry = loadApps().find((a) => a.id === id);
    launchEntry(entry);
    return { launched: id };
  },

  "apps.add": async (entry) => {
    if (!entry || !entry.label || !entry.kind || !entry.target) {
      throw new Error("label, kind and target are required");
    }
    const apps = loadApps();
    const id = entry.id || crypto.randomBytes(4).toString("hex");
    const clean = {
      id,
      label: String(entry.label).slice(0, 40),
      kind: entry.kind,
      target: String(entry.target),
      args: Array.isArray(entry.args) ? entry.args : [],
    };
    if (entry.browser) clean.browser = String(entry.browser);
    if (entry.icon) clean.icon = String(entry.icon);
    const idx = apps.findIndex((a) => a.id === id);
    if (idx >= 0) apps[idx] = clean;
    else apps.push(clean);
    saveApps(apps);
    return { apps };
  },

  "apps.remove": async ({ id }) => {
    const apps = loadApps().filter((a) => a.id !== id);
    saveApps(apps);
    return { apps };
  },
};
