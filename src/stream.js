// Shared MJPEG capture engine: one capture loop feeding all connected viewers.
// Capture via nut.js screen.grab() (native, no external exe), encode with sharp.
// The mouse cursor is a hardware overlay that screen.grab() doesn't capture; the
// phone draws its own cursor overlay (client-side, realtime) instead of baking
// one into these frames — that keeps the pointer smooth independent of frame rate.
import { screen } from "@nut-tree-fork/nut-js";
import sharp from "sharp";

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

// nut.js works in logical (DPI-scaled) coordinates — the space input.moveTo uses,
// so tap-to-click maps against these, not the native capture resolution.
export async function screenSize() {
  return { width: await screen.width(), height: await screen.height() };
}

async function tick() {
  timer = null;
  if (viewers.size === 0 || grabbing) return;
  grabbing = true;
  try {
    const img = await screen.grab();
    const jpg = await sharp(img.data, {
      raw: { width: img.width, height: img.height, channels: img.channels },
    })
      .resize({ width: config.width })
      .removeAlpha()                               // BGRA -> BGR
      .recomb([[0, 0, 1], [0, 1, 0], [1, 0, 0]])   // BGR -> RGB (Windows capture swaps R/B)
      .jpeg({ quality: config.quality })
      .toBuffer();

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
