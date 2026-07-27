// Launcher: list/launch/add/remove entries from apps.json.
import crypto from "node:crypto";
import { loadApps, saveApps } from "../config.js";
import { launch } from "../os/launcher.js";

export const apps = {
  "apps.list": async () => ({ apps: loadApps() }),

  "apps.launch": async ({ id }) => {
    const entry = loadApps().find((a) => a.id === id);
    launch(entry);
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
