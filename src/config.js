// Runtime state (pairing token, launcher entries) living under the data dir.
// Tunable options live in settings.js; this file owns the secrets + launcher.
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";
import { DATA_DIR, getSettings } from "./settings.js";

const SECRET_FILE = path.join(DATA_DIR, "secret.json");
const APPS_FILE = path.join(DATA_DIR, "apps.json");

export const PORT = Number(process.env.LC_PORT) || getSettings().port;
export const BIND = process.env.LC_BIND || getSettings().bind;
export const VERSION = "1.0.0";

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// The pairing token: possessing it grants full control. Created once, reused.
export function loadToken() {
  ensureDataDir();
  if (fs.existsSync(SECRET_FILE)) {
    try {
      const { token } = JSON.parse(fs.readFileSync(SECRET_FILE, "utf8"));
      if (token && typeof token === "string") return token;
    } catch {
      // fall through and regenerate on corruption
    }
  }
  const token = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(SECRET_FILE, JSON.stringify({ token }, null, 2));
  return token;
}

function defaultApps() {
  const home = os.homedir();
  return [
    { id: "chrome", label: "Chrome", kind: "exec", target: "chrome.exe", args: [] },
    { id: "vscode", label: "VS Code", kind: "exec", target: "code.exe", args: [] },
    { id: "files", label: "Files", kind: "folder", target: home },
    { id: "downloads", label: "Downloads", kind: "folder", target: path.join(home, "Downloads") },
    { id: "youtube", label: "YouTube", kind: "url", target: "https://youtube.com" },
    { id: "github", label: "GitHub", kind: "url", target: "https://github.com" },
  ];
}

export function loadApps() {
  ensureDataDir();
  if (fs.existsSync(APPS_FILE)) {
    try {
      const apps = JSON.parse(fs.readFileSync(APPS_FILE, "utf8"));
      if (Array.isArray(apps)) return apps;
    } catch {
      // fall through and reseed on corruption
    }
  }
  const apps = defaultApps();
  saveApps(apps);
  return apps;
}

export function saveApps(apps) {
  ensureDataDir();
  fs.writeFileSync(APPS_FILE, JSON.stringify(apps, null, 2));
}

// First non-internal IPv4, preferring a 192.168.x.x LAN address.
export function lanAddress() {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const list of Object.values(ifaces)) {
    for (const net of list || []) {
      if (net.family === "IPv4" && !net.internal) candidates.push(net.address);
    }
  }
  return (
    candidates.find((a) => a.startsWith("192.168.")) ||
    candidates.find((a) => a.startsWith("10.")) ||
    candidates[0] ||
    "127.0.0.1"
  );
}
