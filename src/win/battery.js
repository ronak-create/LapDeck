// Battery readout via WMI (Win32_Battery). Returns a shape shared with the Linux
// backend: { present, percent, charging }.
import { runPS } from "./ps.js";

export async function battery() {
  try {
    const out = await runPS(
      `$b = Get-CimInstance Win32_Battery | Select-Object -First 1; ` +
        `if ($b) { "$($b.EstimatedChargeRemaining)|$($b.BatteryStatus)" } else { "" }`
    );
    if (!out) return { present: false };
    const [pct, status] = out.split("|");
    // BatteryStatus 2 = AC connected; others = on battery / charging states.
    return {
      present: true,
      percent: parseInt(pct, 10),
      charging: status === "2",
    };
  } catch {
    return { present: false };
  }
}
