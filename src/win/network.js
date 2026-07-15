// Detect Tailscale identity (for control-from-anywhere + the HTTPS app URL).
// Returns null when Tailscale isn't installed or the machine isn't on a tailnet.
import { execFile } from "node:child_process";

const CANDIDATES = [
  "tailscale", // on PATH
  "C:\\Program Files\\Tailscale\\tailscale.exe",
  "C:\\Program Files (x86)\\Tailscale\\tailscale.exe",
];

// Run the tailscale CLI, trying each known location; resolves trimmed stdout.
function run(args) {
  return new Promise((resolve) => {
    let i = 0;
    const tryNext = () => {
      if (i >= CANDIDATES.length) return resolve(null);
      execFile(CANDIDATES[i++], args, { windowsHide: true, timeout: 4000 }, (err, stdout) => {
        if (err) return tryNext();
        resolve((stdout || "").trim());
      });
    };
    tryNext();
  });
}

export async function getTailscaleIp() {
  const out = await run(["ip", "-4"]);
  if (!out) return null;
  const ip = out.split(/\s+/)[0];
  return /^\d+\.\d+\.\d+\.\d+$/.test(ip) ? ip : null;
}

// MagicDNS name (e.g. host.tailnet.ts.net) used for the valid-HTTPS app URL.
export async function getTailscaleDnsName() {
  const out = await run(["status", "--json"]);
  if (!out) return null;
  try {
    const name = JSON.parse(out)?.Self?.DNSName;
    return name ? name.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}
