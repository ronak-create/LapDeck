// Input facade. nut.js drives Windows and Linux X11; ydotool drives Wayland
// (nut.js/libnut can't inject there). Loaded dynamically so the nut.js native
// module isn't required on a Wayland box that may lack X libraries.
import { IS_WAYLAND } from "../platform.js";

const impl = IS_WAYLAND
  ? await import("../linux/input-ydotool.js")
  : await import("../backends/nut-input.js");

export const { move, moveTo, click, down, up, scroll, type, cursor, key } = impl;
