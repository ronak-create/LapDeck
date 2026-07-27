// Battery readout on Linux via sysfs (dependency-free). Returns a shape shared
// with the Windows backend: { present, percent, charging }.
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const SUPPLY_DIR = "/sys/class/power_supply";

// First entry whose `type` is "Battery" (skips AC adapters, USB gadgets, etc.).
function firstBattery() {
  try {
    for (const name of fs.readdirSync(SUPPLY_DIR)) {
      const dir = path.join(SUPPLY_DIR, name);
      try {
        if (fs.readFileSync(path.join(dir, "type"), "utf8").trim() === "Battery") return dir;
      } catch {
        // no `type` file: skip
      }
    }
  } catch {
    // no power_supply class (desktop / VM)
  }
  return null;
}

export async function battery() {
  const dir = firstBattery();
  if (!dir) return { present: false };
  try {
    const percent = parseInt(await fsp.readFile(path.join(dir, "capacity"), "utf8"), 10);
    const status = (await fsp.readFile(path.join(dir, "status"), "utf8")).trim();
    return {
      present: true,
      percent: Number.isFinite(percent) ? percent : null,
      charging: status === "Charging" || status === "Full",
    };
  } catch {
    return { present: false };
  }
}
