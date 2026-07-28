// Shared MJPEG capture engine: one capture loop feeding all connected viewers.
// The actual capture + JPEG encoding lives in the OS screen backend (nut.js on
// Windows/X11, grim/fallback on Wayland); this module owns the single shared
// loop, viewer fan-out, and backpressure handling only.
// The mouse cursor is a hardware overlay the capture doesn't include; the phone
// draws its own client-side cursor overlay instead of baking one into these
// frames — that keeps the pointer smooth independent of frame rate.
import { grabJpeg, screenSize as backendScreenSize } from "./os/screen.js";

const viewers = new Set(); // http response objects currently streaming
let timer = null;
let grabbing = false;

const config = { fps: 4, width: 1280, quality: 60 };

export function setConfig({ fps, width, quality } = {}) {
  if (Number.isFinite(fps)) config.fps = Math.max(1, Math.min(15, fps));
  if (Number.isFinite(width)) config.width = Math.max(480, Math.min(2560, Math.round(width)));
  if (Number.isFinite(quality)) config.quality = Math.max(20, Math.min(90, Math.round(quality)));
  return { ...config };
}

// Logical (DPI-scaled) screen size — the space input.moveTo uses, so tap-to-
// click maps against these, not the native capture resolution.
export async function screenSize() {
  return backendScreenSize();
}

// One-off JPEG grab for the polling fallback (iOS Safari can't render the
// multipart MJPEG stream in an <img>, so it fetches frames one at a time).
// Falls back to the shared loop's config when a param is omitted.
export async function grabOne({ width, quality } = {}) {
  return grabJpeg({
    width: Number.isFinite(width) ? Math.max(480, Math.min(2560, Math.round(width))) : config.width,
    quality: Number.isFinite(quality) ? Math.max(20, Math.min(90, Math.round(quality))) : config.quality,
  });
}

async function tick() {
  timer = null;
  if (viewers.size === 0 || grabbing) return;
  grabbing = true;
  try {
    const jpg = await grabJpeg({ width: config.width, quality: config.quality });

    const head = Buffer.from(
      `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${jpg.length}\r\n\r\n`
    );
    for (const res of viewers) {
      // Skip a viewer whose socket backpressures hard, to avoid piling up frames.
      if (res.writableLength > jpg.length * 3) continue;
      res.write(head);
      res.write(jpg);
      res.write("\r\n");
    }
  } catch {
    // transient grab/encode failure: skip this frame, keep the loop alive
  } finally {
    grabbing = false;
    schedule();
  }
}

function schedule() {
  if (timer || viewers.size === 0) return;
  timer = setTimeout(tick, Math.round(1000 / config.fps));
}

export function addViewer(res) {
  viewers.add(res);
  schedule(); // starts the loop if it was idle
}

export function removeViewer(res) {
  viewers.delete(res);
  if (viewers.size === 0 && timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export function viewerCount() {
  return viewers.size;
}
