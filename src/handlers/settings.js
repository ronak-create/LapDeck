// Settings over the wire: the phone UI reads, patches, and resets them here.
// Token-gated like everything else (the router only sees authed sockets).
import { getSettings, saveSettings, resetSettings, DEFAULTS } from "../settings.js";

// port/bind are accepted in a patch (power users can change them from the
// phone) but only apply after a restart — the response flags that.
export const settingsHandlers = {
  "settings.get": async () => ({ settings: getSettings(), defaults: DEFAULTS }),

  "settings.set": async (patch) => {
    const before = getSettings();
    const settings = saveSettings(patch || {});
    const restartRequired = settings.port !== before.port || settings.bind !== before.bind;
    return { settings, restartRequired };
  },

  "settings.reset": async () => ({ settings: resetSettings() }),
};
