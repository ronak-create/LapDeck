// Launcher facade (launch apps/folders/files/URLs, open paths). Picks backend.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/launcher.js")
  : await import("../linux/launcher.js");

export const { launch, open } = impl;
