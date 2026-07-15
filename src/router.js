// Maps incoming WS message `type` to a handler; wraps every call in try/catch
// so a bad command returns an error envelope instead of crashing the agent.
// Also the enforcement point for feature switches: commands belonging to a
// disabled feature are refused here, regardless of what the UI shows.
import { apps } from "./handlers/apps.js";
import { fsHandlers } from "./handlers/fs.js";
import { media } from "./handlers/media.js";
import { system } from "./handlers/system.js";
import { input } from "./handlers/input.js";
import { screenHandlers } from "./handlers/screen.js";
import { settingsHandlers } from "./handlers/settings.js";
import { featureEnabled } from "./settings.js";

const handlers = {
  ...apps,
  ...fsHandlers,
  ...media,
  ...system,
  ...input,
  ...screenHandlers,
  ...settingsHandlers,
};

// Command prefix → feature switch. Prefixes not listed (apps, settings,
// system.info etc.) are always on.
const FEATURE_BY_PREFIX = {
  "input.": "input",
  "screen.": "screen",
  "fs.": "files",
  "media.": "media",
};
const POWER_COMMANDS = new Set([
  "system.lock", "system.sleep", "system.shutdown", "system.restart", "system.abort",
]);

function featureFor(type) {
  if (POWER_COMMANDS.has(type)) return "power";
  for (const [prefix, feature] of Object.entries(FEATURE_BY_PREFIX)) {
    if (type.startsWith(prefix)) return feature;
  }
  return null;
}

// Dispatch a parsed request envelope; returns a response envelope object.
export async function dispatch(msg) {
  const { id, type, payload } = msg || {};
  const handler = handlers[type];
  if (!handler) {
    return { id, ok: false, error: `unknown command: ${type}` };
  }
  const feature = featureFor(type);
  if (feature && !featureEnabled(feature)) {
    return { id, ok: false, error: `${feature} is disabled in settings` };
  }
  try {
    const data = await handler(payload || {});
    return { id, ok: true, data: data || {} };
  } catch (err) {
    return { id, ok: false, error: err?.message || "command failed" };
  }
}

export const knownTypes = Object.keys(handlers);
