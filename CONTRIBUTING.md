# Contributing to LapDeck

Thanks for helping! A few ground rules keep the project easy to hack on:

- **Plain modern JavaScript.** ESM, Node ≥ 20, no TypeScript, no build step,
  no bundler. The phone UI is vanilla HTML/CSS/JS served statically.
- **OS glue stays behind the `src/os/` facade.** Handlers import a
  platform-neutral capability (`../os/volume.js`, `../os/screen.js`, …); the
  facade picks the backend — `src/win/` (Windows), `src/linux/` (Linux), or the
  shared nut.js backends in `src/backends/` (Windows & Linux X11). Never inline
  a PowerShell snippet or a `pactl`/`ydotool` call into a handler. A new platform
  (e.g. macOS) is a new backend dir + a branch in each `src/os/*.js`.
- **Security first.** Every remote-capable endpoint requires the pairing
  token. No unauthenticated command may ever execute. Destructive actions
  keep their `confirm` + settings-permission double gate.
- **The client stays dumb.** Control logic lives in the agent; clients only
  send protocol messages. Protocol changes go in `docs/PROTOCOL.md`.
- **Dependencies are a last resort.** The runtime deps are express, ws,
  sharp, nut-js, qrcode-terminal — think hard before adding more.

## Dev loop

```powershell
npm install
npm run dev        # --watch: restarts on save
```

Then open the printed URL on a phone on the same Wi-Fi (or in a desktop
browser with devtools' device emulation — touch events matter).

Manual test before a PR: pair a real Android phone, and exercise whatever you
touched — launcher, touchpad, keyboard, screen view, settings. There is no
test suite for the OS-glue parts; honest manual testing is the bar.

## Good first contributions

- macOS backend (`src/mac/`) behind the `src/os/` facade
- Wayland scroll via a `ydotool` wheel path (or a PipeWire-portal screen backend)
- Multi-monitor screen view
- Clipboard sync (send/fetch clipboard text)
- Wake-on-LAN companion
- Localization of the UI
