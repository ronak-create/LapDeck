// Volume + media-transport facade. Picks the platform backend at load time.
import { IS_WIN } from "../platform.js";

const impl = IS_WIN
  ? await import("../win/volume.js")
  : await import("../linux/volume.js");

export const {
  volumeUp, volumeDown, toggleMute,
  mediaPlayPause, mediaNext, mediaPrev,
  getVolume, isMuted, setVolume,
} = impl;
