// Screen-view WS handlers. The actual pixels flow over the /stream.mjpeg HTTP
// endpoint (see index.js); these just configure the loop and report screen size.
import { setConfig, screenSize } from "../stream.js";

export const screenHandlers = {
  // Sets stream quality (global, single shared loop) and returns the info the
  // client needs: the stream path and the logical screen size for tap mapping.
  "screen.start": async ({ fps, width, quality } = {}) => {
    const cfg = setConfig({ fps, width, quality });
    const { width: sw, height: sh } = await screenSize();
    return { url: "/stream.mjpeg", screenW: sw, screenH: sh, config: cfg };
  },

  // Viewers actually stop when the client clears the <img> src (closing the HTTP
  // stream); this is here for explicit control / future use.
  "screen.stop": async () => ({}),
};
