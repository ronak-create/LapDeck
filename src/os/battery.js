// Battery-readout facade. Picks the platform backend at load time.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/battery.js")
  : await import("../linux/battery.js");

export const { battery } = impl;
