// Wayland screen-capture backend. nut.js/libnut can't capture under Wayland, so
// we shell out to a CLI grabber and re-encode with sharp. Capture chain, first
// available: grim (wlroots: Sway/Hyprland) -> gnome-screenshot -> spectacle (KDE).
//
// GNOME/KDE Wayland sessions that only permit the xdg-desktop-portal ScreenCast
// route (no CLI grab) will hit the "no grabber" error — everything else in the
// app still works. Full PipeWire-portal streaming is out of scope for now.
//
// Implements the normalized screen interface consumed by stream.js:
//   screenSize() -> { width, height }
//   grabJpeg({ width, quality }) -> Buffer (JPEG)
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import sharp from "sharp";
import { has } from "./run.js";

// Run a grabber capturing binary stdout (execFile's string mode would corrupt
// PNG bytes).
function execBuf(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: "buffer", maxBuffer: 64 * 1024 * 1024, timeout: 8000 },
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT") reject(new Error(`${cmd} not installed`));
          else reject(new Error((stderr?.toString() || err.message).split("\n")[0]));
          return;
        }
        resolve(stdout);
      });
  });
}

let grabber; // "grim" | "gnome-screenshot" | "spectacle" | false | undefined
async function resolveGrabber() {
  if (grabber !== undefined) return grabber;
  if (await has("grim")) grabber = "grim";
  else if (await has("gnome-screenshot")) grabber = "gnome-screenshot";
  else if (await has("spectacle")) grabber = "spectacle";
  else grabber = false;
  return grabber;
}

// Capture the screen as a PNG buffer via whichever grabber is available.
async function capturePng() {
  const g = await resolveGrabber();
  if (!g) {
    throw new Error(
      "no Wayland screen grabber found — install grim (wlroots) or use an X11 session"
    );
  }
  if (g === "grim") return execBuf("grim", ["-t", "png", "-"]);

  // File-based grabbers: capture to a temp file, read it, clean up.
  const tmp = path.join(os.tmpdir(), `lapdeck-${process.pid}-${Date.now()}.png`);
  try {
    if (g === "gnome-screenshot") await execBuf("gnome-screenshot", ["-f", tmp]);
    else await execBuf("spectacle", ["-b", "-n", "-o", tmp]);
    return await fsp.readFile(tmp);
  } finally {
    fsp.unlink(tmp).catch(() => {});
  }
}

export async function screenSize() {
  const png = await capturePng();
  const meta = await sharp(png).metadata();
  return { width: meta.width, height: meta.height };
}

export async function grabJpeg({ width = 1280, quality = 60 } = {}) {
  const png = await capturePng();
  return sharp(png).resize({ width }).jpeg({ quality }).toBuffer();
}
