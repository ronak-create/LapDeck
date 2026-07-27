// Linux volume + media transport. Volume/mute via `pactl` (covers PulseAudio and
// PipeWire's pipewire-pulse); transport keys via `playerctl` (MPRIS). Mirrors the
// export surface of win/volume.js.
import { run } from "./run.js";

const SINK = "@DEFAULT_SINK@";
const STEP = 5; // percent per step, matching the feel of a media-key volume nudge

export async function volumeUp(steps = 1) {
  await run("pactl", ["set-sink-volume", SINK, `+${STEP * steps}%`]);
}
export async function volumeDown(steps = 1) {
  await run("pactl", ["set-sink-volume", SINK, `-${STEP * steps}%`]);
}
export async function toggleMute() {
  await run("pactl", ["set-sink-mute", SINK, "toggle"]);
}
export async function mediaPlayPause() {
  await run("playerctl", ["play-pause"]);
}
export async function mediaNext() {
  await run("playerctl", ["next"]);
}
export async function mediaPrev() {
  await run("playerctl", ["previous"]);
}

export async function getVolume() {
  // e.g. "Volume: front-left: 45000 /  69% / -9.30 dB, front-right: ..."
  const out = await run("pactl", ["get-sink-volume", SINK]);
  const m = out.match(/(\d+)%/);
  return m ? Math.max(0, Math.min(100, parseInt(m[1], 10))) : null;
}

export async function isMuted() {
  const out = await run("pactl", ["get-sink-mute", SINK]); // "Mute: yes" | "Mute: no"
  return /yes/i.test(out);
}

export async function setVolume(level) {
  const clamped = Math.max(0, Math.min(100, Math.round(level)));
  await run("pactl", ["set-sink-volume", SINK, `${clamped}%`]);
  return clamped;
}
