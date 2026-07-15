// User-tunable settings living in data/settings.json, deep-merged over DEFAULTS.
// Anything absent from the file silently falls back to its default, so the file
// only ever needs to contain what the user actually changed. Env overrides:
//   LC_PORT      — listen port (beats settings.port)
//   LC_BIND      — bind address (beats settings.bind)
//   LC_DATA_DIR  — relocate the data directory entirely
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.LC_DATA_DIR || path.join(__dirname, "..", "data");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export const DEFAULTS = {
  // Server (changes require an agent restart).
  port: 8765,
  bind: "0.0.0.0",

  // Shown in the phone UI instead of the Windows hostname when set.
  deviceName: "",

  // UI theme, applied on every paired phone.
  theme: { accent: "#4c8dff" },

  // Feature switches: a disabled feature is refused server-side (the UI also
  // hides it, but the server is the enforcement point).
  features: {
    screen: true, // live screen view + tap-to-click
    input: true, // touchpad + keyboard injection
    files: true, // filesystem browsing / opening
    media: true, // volume + transport keys
    power: true, // lock / sleep / shutdown / restart
  },

  // Per-action power permissions (only consulted when features.power is on).
  power: {
    allowSleep: true,
    allowShutdown: true,
    allowRestart: true,
    graceSeconds: 5, // countdown before shutdown/restart actually fires
  },

  // Screen-view quality presets offered by the UI. Tune freely.
  stream: {
    presets: {
      low: { fps: 2, width: 960, quality: 45 },
      med: { fps: 4, width: 1280, quality: 60 },
      high: { fps: 6, width: 1600, quality: 72 },
    },
  },

  // User-defined shortcut buttons on the Keyboard screen.
  // Each entry: { id, label, keys } where keys is a chord like "ctrl+shift+p"
  // or a comma-separated chord sequence like "ctrl+k,ctrl+o".
  shortcuts: [],
};

function isObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Recursive merge of `patch` over `base`; arrays and scalars replace wholesale.
function deepMerge(base, patch) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch || {})) {
    out[k] = isObject(v) && isObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

// Coerce everything security- or stability-relevant back into a sane range, so
// a hand-edited settings.json can't wedge the agent or relax the confirm flow.
function sanitize(s) {
  s.port = Math.max(1, Math.min(65535, Math.round(Number(s.port) || DEFAULTS.port)));
  s.bind = typeof s.bind === "string" && s.bind ? s.bind : DEFAULTS.bind;
  s.deviceName = String(s.deviceName || "").slice(0, 40);
  if (!HEX_COLOR.test(s.theme?.accent || "")) s.theme = { ...s.theme, accent: DEFAULTS.theme.accent };
  for (const k of Object.keys(DEFAULTS.features)) s.features[k] = Boolean(s.features[k]);
  for (const k of ["allowSleep", "allowShutdown", "allowRestart"]) s.power[k] = Boolean(s.power[k]);
  s.power.graceSeconds = Math.max(0, Math.min(60, Math.round(Number(s.power.graceSeconds) || 0)));
  for (const p of Object.values(s.stream.presets)) {
    p.fps = Math.max(1, Math.min(15, Math.round(Number(p.fps) || 4)));
    p.width = Math.max(480, Math.min(2560, Math.round(Number(p.width) || 1280)));
    p.quality = Math.max(20, Math.min(90, Math.round(Number(p.quality) || 60)));
  }
  s.shortcuts = (Array.isArray(s.shortcuts) ? s.shortcuts : [])
    .filter((sc) => sc && sc.label && sc.keys)
    .slice(0, 30)
    .map((sc) => ({
      id: String(sc.id || Math.random().toString(16).slice(2, 10)),
      label: String(sc.label).slice(0, 24),
      keys: String(sc.keys).toLowerCase().replace(/[^a-z0-9+,\- ]/g, "").slice(0, 60),
    }));
  return s;
}

let cached = null;

export function getSettings() {
  if (cached) return cached;
  let saved = {};
  try {
    saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    // missing or corrupt file: run on pure defaults
  }
  cached = sanitize(deepMerge(DEFAULTS, saved));
  return cached;
}

// Deep-merge a partial patch into the current settings and persist. Returns
// the full merged settings. Port/bind changes take effect on next restart.
export function saveSettings(patch) {
  const merged = sanitize(deepMerge(getSettings(), patch));
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2));
  cached = merged;
  return merged;
}

export function resetSettings() {
  try {
    fs.unlinkSync(SETTINGS_FILE);
  } catch {
    // already gone
  }
  cached = null;
  return getSettings();
}

export function featureEnabled(name) {
  return getSettings().features[name] !== false;
}
