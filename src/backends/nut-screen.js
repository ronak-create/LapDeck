// nut.js screen-capture backend — used on Windows and Linux X11. nut.js grabs
// via the native libnut backend (DXGI on Windows, X11 on Linux); it cannot
// capture under Wayland, which is why linux/screen-wl.js exists for that case.
//
// Exposes the normalized screen interface consumed by stream.js:
//   screenSize()  -> { width, height }   (logical / DPI-scaled coords)
//   grabJpeg({ width, quality }) -> Buffer (JPEG)
//
// The mouse cursor is a hardware overlay libnut doesn't capture; the phone draws
// its own client-side cursor overlay, keeping the pointer smooth independent of
// frame rate — so nothing here needs to composite a cursor.
import { screen } from "@nut-tree-fork/nut-js";
import sharp from "sharp";

// nut.js works in logical (DPI-scaled) coordinates — the space input.moveTo uses,
// so tap-to-click maps against these, not the native capture resolution.
export async function screenSize() {
  return { width: await screen.width(), height: await screen.height() };
}

export async function grabJpeg({ width = 1280, quality = 60 } = {}) {
  const img = await screen.grab();
  return sharp(img.data, {
    raw: { width: img.width, height: img.height, channels: img.channels },
  })
    .resize({ width })
    .removeAlpha()                               // BGRA -> BGR
    .recomb([[0, 0, 1], [0, 1, 0], [1, 0, 0]])   // BGR -> RGB (libnut returns BGRA)
    .jpeg({ quality })
    .toBuffer();
}
