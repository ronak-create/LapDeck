// Wayland input backend via `ydotool` (uinput). Wayland compositors block the
// X11 injection nut.js relies on, so ydotool talks to the kernel uinput device
// instead. Requires `ydotoold` running and uinput access (see scripts/docs).
//
// Implements the normalized input interface (same surface as backends/nut-input):
//   move, moveTo, click, down, up, scroll, type, cursor, key
//
// Limitations vs the nut.js backend, both inherent to Wayland/ydotool:
//   - cursor():  the compositor won't report the pointer position; we return the
//                last position we set, so the phone's predicted overlay still has
//                something to reconcile against.
//   - scroll():  ydotool's CLI has no wheel command — scroll is a no-op here.
import { run } from "./run.js";

function yd(args) {
  return run("ydotool", args);
}

// ydotool click button byte: low nibble = button (0 left,1 right,2 middle),
// 0x40 = press, 0x80 = release, 0xC0 = press+release.
const BTN = { left: 0, right: 1, middle: 2 };
function btn(name) {
  return BTN[name] ?? BTN.left;
}
const hex = (n) => "0x" + n.toString(16).toUpperCase().padStart(2, "0");

// Predicted pointer position (ydotool can't read the real one back).
let last = { x: 0, y: 0 };

export async function move({ dx = 0, dy = 0 } = {}) {
  await yd(["mousemove", "--", String(Math.round(dx)), String(Math.round(dy))]);
  last = { x: last.x + Math.round(dx), y: last.y + Math.round(dy) };
}

export async function moveTo({ x, y } = {}) {
  await yd(["mousemove", "--absolute", "--", String(Math.round(x)), String(Math.round(y))]);
  last = { x: Math.round(x), y: Math.round(y) };
}

export async function click({ button = "left", double = false } = {}) {
  const b = btn(button);
  await yd(["click", hex(0xc0 | b)]);
  if (double) await yd(["click", hex(0xc0 | b)]);
}

export async function down({ button = "left" } = {}) {
  await yd(["click", hex(0x40 | btn(button))]);
}
export async function up({ button = "left" } = {}) {
  await yd(["click", hex(0x80 | btn(button))]);
}

// ydotool's CLI exposes no wheel event; scrolling is unsupported on Wayland.
export async function scroll() {
  /* no-op: documented Wayland limitation */
}

export async function type({ text } = {}) {
  if (text) await yd(["type", "--", text]);
}

// No real readback on Wayland — return our predicted position.
export async function cursor() {
  return { x: last.x, y: last.y };
}

// Linux input-event key codes (subset matching backends/nut-input's KEYMAP).
const KEYCODE = {
  a: 30, b: 48, c: 46, d: 32, e: 18, f: 33, g: 34, h: 35, i: 23, j: 36,
  k: 37, l: 38, m: 50, n: 49, o: 24, p: 25, q: 16, r: 19, s: 31, t: 20,
  u: 22, v: 47, w: 17, x: 45, y: 21, z: 44,
  0: 11, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10,
  enter: 28, esc: 1, escape: 1, tab: 15, backspace: 14, delete: 111, del: 111,
  up: 103, down: 108, left: 105, right: 106, space: 57,
  home: 102, end: 107, pageup: 104, pagedown: 109,
  // numpad +/- for reliable zoom, matching the nut backend
  plus: 78, "+": 78, add: 78, minus: 74, "-": 74, subtract: 74,
  win: 125, super: 125, meta: 125, ctrl: 29, control: 29, alt: 56, shift: 42,
  f1: 59, f2: 60, f3: 61, f4: 62, f5: 63, f6: 64,
  f7: 65, f8: 66, f9: 67, f10: 68, f11: 87, f12: 88,
};
const MODCODE = {
  ctrl: 29, control: 29, alt: 56, shift: 42, win: 125, meta: 125, super: 125,
};

function resolveKey(name) {
  const low = String(name || "").toLowerCase();
  return KEYCODE[low] ?? null;
}

export async function key({ key: name, modifiers = [] } = {}) {
  const k = resolveKey(name);
  if (k == null) throw new Error("unknown key: " + name);
  const mods = modifiers
    .map((m) => MODCODE[String(m).toLowerCase()])
    .filter((c) => c != null);
  // Press mods, press+release key, release mods (reverse order) — ydotool `key`
  // takes <code>:<1|0> pairs applied in sequence.
  const seq = [
    ...mods.map((c) => `${c}:1`),
    `${k}:1`,
    `${k}:0`,
    ...mods.reverse().map((c) => `${c}:0`),
  ];
  await yd(["key", ...seq]);
}
