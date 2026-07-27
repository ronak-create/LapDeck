// Internal-display brightness on Linux. Prefers `brightnessctl` (no root needed
// when the user is in the `video` group / a udev rule grants access); falls back
// to raw sysfs. Mirrors win/brightness.js.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { run, has } from "./run.js";

const BACKLIGHT_DIR = "/sys/class/backlight";

// First backlight device exposed by the kernel, if any.
function firstBacklight() {
  try {
    const [name] = fs.readdirSync(BACKLIGHT_DIR);
    return name ? path.join(BACKLIGHT_DIR, name) : null;
  } catch {
    return null;
  }
}

export async function getBrightness() {
  if (await has("brightnessctl")) {
    const cur = parseInt(await run("brightnessctl", ["get"]), 10);
    const max = parseInt(await run("brightnessctl", ["max"]), 10);
    if (Number.isFinite(cur) && Number.isFinite(max) && max > 0) {
      return Math.round((cur / max) * 100);
    }
  }
  const dev = firstBacklight();
  if (!dev) return null;
  const cur = parseInt(await fsp.readFile(path.join(dev, "brightness"), "utf8"), 10);
  const max = parseInt(await fsp.readFile(path.join(dev, "max_brightness"), "utf8"), 10);
  return Number.isFinite(cur) && max > 0 ? Math.round((cur / max) * 100) : null;
}

export async function setBrightness(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  if (await has("brightnessctl")) {
    await run("brightnessctl", ["set", `${clamped}%`]);
    return clamped;
  }
  const dev = firstBacklight();
  if (!dev) throw new Error("no backlight device; install brightnessctl");
  const max = parseInt(await fsp.readFile(path.join(dev, "max_brightness"), "utf8"), 10);
  const value = Math.round((clamped / 100) * max);
  try {
    await fsp.writeFile(path.join(dev, "brightness"), String(value));
  } catch {
    throw new Error("cannot write brightness — install brightnessctl or add a udev rule");
  }
  return clamped;
}
