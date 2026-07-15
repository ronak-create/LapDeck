// Lock / sleep / shutdown / restart. Destructive ops use a grace delay + abort.
import { execFile } from "node:child_process";

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { windowsHide: true }, (err) => {
      // Some of these exit nonzero even on success; callers that care handle it.
      if (err && err.code === "ENOENT") reject(new Error(`${cmd} not found`));
      else resolve();
    });
  });
}

export function lock() {
  return run("rundll32.exe", ["user32.dll,LockWorkStation"]);
}

// Note: hibernates instead of sleeping if hibernate is enabled (documented in UI).
export function sleep() {
  return run("rundll32.exe", ["powrprof.dll,SetSuspendState", "0,1,0"]);
}

// Grace delay (settings.power.graceSeconds) so a mistaken confirm can still
// be aborted from the UI.
export function shutdown(grace = 5) {
  return run("shutdown", ["/s", "/t", String(grace)]);
}
export function restart(grace = 5) {
  return run("shutdown", ["/r", "/t", String(grace)]);
}
export function abortShutdown() {
  return run("shutdown", ["/a"]);
}
