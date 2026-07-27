// Platform + display-server detection. The single source of truth the OS facade
// (src/os/*) uses to pick a backend. Kept dependency-free and evaluated once.
import os from "node:os";

export const IS_WIN = process.platform === "win32";
export const IS_LINUX = process.platform === "linux";
export const IS_MAC = process.platform === "darwin";

// Linux display server: "wayland" | "x11" | "unknown". On Windows/mac this is
// "unknown" and unused. Wayland vs X11 decides whether input/screen use the
// nut.js backends (X11) or the ydotool/grim backends (Wayland).
function detectSession() {
  if (!IS_LINUX) return "unknown";
  const type = (process.env.XDG_SESSION_TYPE || "").toLowerCase();
  if (type === "wayland") return "wayland";
  if (type === "x11") return "x11";
  // Fall back to the display env vars when XDG_SESSION_TYPE is unset (e.g. a
  // bare login shell or some minimal WMs).
  if (process.env.WAYLAND_DISPLAY) return "wayland";
  if (process.env.DISPLAY) return "x11";
  return "unknown";
}

export const SESSION = detectSession();
export const IS_WAYLAND = SESSION === "wayland";
export const IS_X11 = SESSION === "x11";

// Human-readable platform label for logs / system.info.
export function platformLabel() {
  if (IS_WIN) return "windows";
  if (IS_LINUX) return SESSION === "unknown" ? "linux" : `linux-${SESSION}`;
  if (IS_MAC) return "macos";
  return process.platform;
}

// Best-effort hostname (COMPUTERNAME is Windows-only; os.hostname() is portable).
export function hostname() {
  return process.env.COMPUTERNAME || os.hostname() || "laptop";
}
