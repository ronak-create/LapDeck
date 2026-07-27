// Mouse + keyboard command handlers. The actual injection lives in the OS input
// backend (nut.js on Windows/X11, ydotool on Wayland); this module is a thin
// adapter mapping WS commands onto the normalized backend interface.
import * as dev from "../os/input.js";

export const input = {
  // Relative move (touchpad). dx/dy in device pixels.
  "input.move": async ({ dx = 0, dy = 0 } = {}) => {
    await dev.move({ dx, dy });
    return {};
  },

  // Absolute move (tap-to-click on the live screen view).
  "input.moveTo": async ({ x, y } = {}) => {
    await dev.moveTo({ x, y });
    return {};
  },

  "input.click": async ({ button = "left", double = false } = {}) => {
    await dev.click({ button, double });
    return {};
  },

  "input.down": async ({ button = "left" } = {}) => {
    await dev.down({ button });
    return {};
  },
  "input.up": async ({ button = "left" } = {}) => {
    await dev.up({ button });
    return {};
  },

  // Positive dy = scroll down; positive dx = scroll right.
  "input.scroll": async ({ dy = 0, dx = 0 } = {}) => {
    await dev.scroll({ dy, dx });
    return {};
  },

  // Unicode text entry.
  "input.type": async ({ text } = {}) => {
    await dev.type({ text });
    return {};
  },

  // Current pointer position (logical coords). The client polls this at a low
  // rate to reconcile its realtime cursor overlay against reality. May be an
  // approximation on Wayland, where the compositor won't report the real one.
  "input.cursor": async () => {
    const p = await dev.cursor();
    return p ? { x: p.x, y: p.y } : {};
  },

  // Named key, optionally with modifiers (chord press+release).
  "input.key": async ({ key, modifiers = [] } = {}) => {
    await dev.key({ key, modifiers });
    return {};
  },
};
