# Contributing to LapDeck

Thanks for helping! A few ground rules keep the project easy to hack on:

- **Plain modern JavaScript.** ESM, Node ≥ 20, no TypeScript, no build step,
  no bundler. The phone UI is vanilla HTML/CSS/JS served statically.
- **Windows glue stays in `src/win/`.** PowerShell snippets and OS-specific
  commands never get inlined into handlers — that's also the seam a
  macOS/Linux port would implement.
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

- macOS / Linux ports of `src/win/`
- Multi-monitor screen view
- Clipboard sync (send/fetch clipboard text)
- Wake-on-LAN companion
- Localization of the UI
