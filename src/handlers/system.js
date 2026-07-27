// System info + power + brightness. Destructive ops require confirm:true AND
// the matching allow* switch in settings.power.
import os from "node:os";
import * as power from "../os/power.js";
import { getBrightness, setBrightness } from "../os/brightness.js";
import { getVolume, isMuted } from "../os/volume.js";
import { battery } from "../os/battery.js";
import { getTailscaleIp, getTailscaleDnsName } from "../os/network.js";
import { PORT, VERSION, lanAddress } from "../config.js";
import { getSettings } from "../settings.js";

// A destructive op needs the client's confirm flag AND the settings switch.
function guard(confirm, allowed, what) {
  if (!allowed) throw new Error(`${what} is disabled in settings`);
  if (!confirm) throw new Error("confirmation required");
}

export const system = {
  "system.info": async () => {
    const [bat, brightness, volume, muted] = await Promise.all([
      battery(),
      getBrightness().catch(() => null),
      getVolume().catch(() => null),
      isMuted().catch(() => false),
    ]);
    const { deviceName } = getSettings();
    return {
      hostname: os.hostname(),
      deviceName: deviceName || null,
      version: VERSION,
      uptime: Math.round(os.uptime()),
      battery: bat,
      brightness,
      volume,
      muted,
    };
  },

  // Reachable addresses so the app can offer one-tap remote + secure-app links.
  "system.addresses": async () => {
    const [tailscale, dns] = await Promise.all([getTailscaleIp(), getTailscaleDnsName()]);
    return {
      lan: lanAddress(),
      tailscale,
      dns,
      port: PORT,
      httpsUrl: dns ? `https://${dns}` : null,
    };
  },

  "system.brightness": async ({ level }) => {
    const set = await setBrightness(level);
    return { brightness: set };
  },

  "system.lock": async () => {
    await power.lock();
    return {};
  },

  "system.sleep": async ({ confirm } = {}) => {
    guard(confirm, getSettings().power.allowSleep, "sleep");
    await power.sleep();
    return {};
  },

  "system.shutdown": async ({ confirm } = {}) => {
    const { allowShutdown, graceSeconds } = getSettings().power;
    guard(confirm, allowShutdown, "shutdown");
    await power.shutdown(graceSeconds);
    return { grace: graceSeconds };
  },

  "system.restart": async ({ confirm } = {}) => {
    const { allowRestart, graceSeconds } = getSettings().power;
    guard(confirm, allowRestart, "restart");
    await power.restart(graceSeconds);
    return { grace: graceSeconds };
  },

  "system.abort": async () => {
    await power.abortShutdown();
    return {};
  },
};
