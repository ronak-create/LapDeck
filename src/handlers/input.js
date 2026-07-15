// Mouse + keyboard injection via the nut.js fork.
import { mouse, keyboard, Point, Button, Key } from "@nut-tree-fork/nut-js";

mouse.config.autoDelayMs = 0; // snappy touchpad; no artificial delay between calls
keyboard.config.autoDelayMs = 3; // tiny per-keystroke delay so no app drops chars

const BUTTONS = { left: Button.LEFT, right: Button.RIGHT, middle: Button.MIDDLE };

// Cache the cursor position so rapid moves within a gesture avoid a getPosition
// round-trip; re-sync from the real cursor when a new gesture starts (>400ms gap)
// so physical-mouse drift can't accumulate.
let last = null;
let lastT = 0;
async function syncedPos() {
  const now = Date.now();
  if (!last || now - lastT > 400) last = await mouse.getPosition();
  lastT = now;
  return last;
}

const KEYMAP = {
  enter: Key.Enter, esc: Key.Escape, escape: Key.Escape, tab: Key.Tab,
  backspace: Key.Backspace, delete: Key.Delete, del: Key.Delete,
  up: Key.Up, down: Key.Down, left: Key.Left, right: Key.Right,
  space: Key.Space, home: Key.Home, end: Key.End,
  pageup: Key.PageUp, pagedown: Key.PageDown,
  // numpad +/- : reliable zoom in/out across browsers & apps (no Shift needed)
  plus: Key.Add, "+": Key.Add, add: Key.Add,
  minus: Key.Subtract, "-": Key.Subtract, subtract: Key.Subtract,
  // modifiers also usable as standalone keys (tap Win = open Start, etc.)
  win: Key.LeftSuper, super: Key.LeftSuper, meta: Key.LeftSuper,
  ctrl: Key.LeftControl, control: Key.LeftControl,
  alt: Key.LeftAlt, shift: Key.LeftShift,
};
const MODMAP = {
  ctrl: Key.LeftControl, control: Key.LeftControl,
  alt: Key.LeftAlt, shift: Key.LeftShift,
  win: Key.LeftSuper, meta: Key.LeftSuper, super: Key.LeftSuper,
};

function resolveKey(key) {
  if (!key) return null;
  const low = String(key).toLowerCase();
  if (KEYMAP[low] != null) return KEYMAP[low];
  if (/^f([1-9]|1[0-2])$/.test(low)) return Key["F" + low.slice(1)];
  if (/^[a-z]$/.test(low)) return Key[low.toUpperCase()];
  if (/^[0-9]$/.test(low)) return Key["Num" + low];
  return null;
}
function resolveMod(m) {
  return MODMAP[String(m).toLowerCase()] ?? null;
}

export const input = {
  // Relative move (touchpad). dx/dy in device pixels.
  "input.move": async ({ dx = 0, dy = 0 }) => {
    const p = await syncedPos();
    const np = new Point(Math.round(p.x + dx), Math.round(p.y + dy));
    await mouse.setPosition(np);
    last = np;
    return {};
  },

  // Absolute move (tap-to-click in Phase 3).
  "input.moveTo": async ({ x, y }) => {
    const np = new Point(Math.round(x), Math.round(y));
    await mouse.setPosition(np);
    last = np;
    lastT = Date.now();
    return {};
  },

  "input.click": async ({ button = "left", double = false } = {}) => {
    const b = BUTTONS[button] ?? Button.LEFT;
    await mouse.click(b);
    if (double) await mouse.click(b);
    return {};
  },

  "input.down": async ({ button = "left" } = {}) => {
    await mouse.pressButton(BUTTONS[button] ?? Button.LEFT);
    return {};
  },
  "input.up": async ({ button = "left" } = {}) => {
    await mouse.releaseButton(BUTTONS[button] ?? Button.LEFT);
    return {};
  },

  // Positive dy = scroll down; positive dx = scroll right.
  "input.scroll": async ({ dy = 0, dx = 0 } = {}) => {
    if (dy > 0) await mouse.scrollDown(Math.abs(dy));
    else if (dy < 0) await mouse.scrollUp(Math.abs(dy));
    if (dx > 0) await mouse.scrollRight(Math.abs(dx));
    else if (dx < 0) await mouse.scrollLeft(Math.abs(dx));
    return {};
  },

  // Unicode text entry.
  "input.type": async ({ text } = {}) => {
    if (text) await keyboard.type(text);
    return {};
  },

  // Current pointer position (logical coords). Cheap; the client polls this at a
  // low rate to reconcile its realtime cursor overlay against reality.
  "input.cursor": async () => {
    const p = await mouse.getPosition();
    return { x: p.x, y: p.y };
  },

  // Named key, optionally with modifiers (chord press+release).
  "input.key": async ({ key, modifiers = [] } = {}) => {
    const k = resolveKey(key);
    if (k == null) throw new Error("unknown key: " + key);
    const mods = modifiers.map(resolveMod).filter((m) => m != null);
    if (mods.length) {
      await keyboard.pressKey(...mods, k);
      await keyboard.releaseKey(...mods, k);
    } else {
      await keyboard.type(k);
    }
    return {};
  },
};
