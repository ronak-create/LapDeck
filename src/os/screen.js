// Screen-capture facade. nut.js grabs on Windows and Linux X11; grim/fallback
// grabs on Wayland. Loaded dynamically so nut.js native module isn't required on
// a Wayland box that may lack X libraries.
import { IS_WAYLAND } from "../platform.js";

const impl = IS_WAYLAND
  ? await import("../linux/screen-wl.js")
  : await import("../backends/nut-screen.js");

export const { screenSize, grabJpeg } = impl;
