// Lock / sleep / shutdown / restart on Linux via systemd + loginctl. polkit
// normally lets the active local user suspend/poweroff/reboot without a password.
//
// Grace/abort: shutdown & restart schedule a JS timer (mirroring Windows'
// `shutdown /t` + `/a`) rather than shelling out with a delay, so a single
// `abort` cancels it. If the agent is restarted during the window the pending
// action is dropped — which is the safe failure mode.
import { run } from "./run.js";

let pending = null; // { timer } of a scheduled poweroff/reboot, or null

function schedule(action, grace) {
  cancel();
  const ms = Math.max(0, Math.round(grace)) * 1000;
  // systemctl poweroff/reboot; loginctl also works but systemctl is universal.
  const fire = () => { pending = null; run("systemctl", [action]).catch(() => {}); };
  if (ms === 0) fire();
  else pending = setTimeout(fire, ms);
}

function cancel() {
  if (pending) { clearTimeout(pending); pending = null; }
}

export function lock() {
  return run("loginctl", ["lock-session"]);
}

export function sleep() {
  return run("systemctl", ["suspend"]);
}

export async function shutdown(grace = 5) {
  schedule("poweroff", grace);
}

export async function restart(grace = 5) {
  schedule("reboot", grace);
}

export async function abortShutdown() {
  cancel();
}
