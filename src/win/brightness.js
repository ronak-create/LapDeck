// Internal-display brightness via WMI. Fails cleanly on external monitors.
import { runPS } from "./ps.js";

export async function getBrightness() {
  const out = await runPS(
    `(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness`
  );
  const n = parseInt(out, 10);
  return Number.isFinite(n) ? n : null;
}

export async function setBrightness(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  await runPS(
    `Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | ` +
      `Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=0; Brightness=${clamped}} | Out-Null`
  );
  return clamped;
}
