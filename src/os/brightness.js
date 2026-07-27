// Brightness facade. Picks the platform backend at load time.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/brightness.js")
  : await import("../linux/brightness.js");

export const { getBrightness, setBrightness } = impl;
