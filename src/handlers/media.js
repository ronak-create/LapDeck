// Volume, mute, and transport controls.
import * as vol from "../win/volume.js";

export const media = {
  "media.playpause": async () => {
    await vol.mediaPlayPause();
    return {};
  },
  "media.next": async () => {
    await vol.mediaNext();
    return {};
  },
  "media.prev": async () => {
    await vol.mediaPrev();
    return {};
  },
  "media.mute": async () => {
    await vol.toggleMute();
    return {};
  },
  // { delta: ±steps } steps the volume; { set: 0-100 } sets it absolutely.
  "media.volume": async ({ delta, set } = {}) => {
    if (typeof set === "number") {
      const level = await vol.setVolume(set);
      return { level };
    }
    const steps = Math.abs(Math.round(delta || 0)) || 1;
    if ((delta || 0) >= 0) await vol.volumeUp(steps);
    else await vol.volumeDown(steps);
    return {};
  },
};
