// Power facade (lock/sleep/shutdown/restart/abort). Picks the backend at load.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/power.js")
  : await import("../linux/power.js");

export const { lock, sleep, shutdown, restart, abortShutdown } = impl;
