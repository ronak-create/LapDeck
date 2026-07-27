// Tailscale-detection facade. Picks the platform backend at load time.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/network.js")
  : await import("../linux/network.js");

export const { getTailscaleIp, getTailscaleDnsName } = impl;
