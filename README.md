# LapDeck

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)](https://nodejs.org)
[![Platform](https://img.shields.io/badge/platform-Windows%2010%2F11-0078d4.svg)](#faq)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-8b5cf6.svg)](CONTRIBUTING.md)

**Turn your phone into a remote deck for your Windows laptop.**

App launcher · touchpad · keyboard · live screen view · media & volume · brightness · lock/sleep/shutdown — all from the phone in your hand, over your own Wi-Fi. One Node.js process on the laptop, a PWA on the phone, zero cloud, zero accounts.

```
Phone (browser / installed PWA)  ── Wi-Fi / Tailscale ──►  LapDeck agent (Node.js on Windows)
```

Lying in bed and want to pause the movie, nudge the volume, or shut the laptop down? Presenting and need a remote touchpad? LapDeck is a single `npm start` away.

<p align="center">
  <img src="docs/screenshots/launcher.png" width="24%" alt="Launcher" />
  <img src="docs/screenshots/touchpad.png" width="24%" alt="Touchpad" />
  <img src="docs/screenshots/keyboard.png" width="24%" alt="Keyboard with custom shortcuts" />
  <img src="docs/screenshots/settings.png" width="24%" alt="Settings" />
</p>

## Features

- **App launcher** — tiles for apps, folders, files, and websites. Add/remove tiles from the phone; pick which browser opens a site.
- **Touchpad** — relative pointer with acceleration, tap-to-click, two-finger scroll, two-finger tap = right-click, double-tap-drag. Pointer speed slider.
- **Keyboard** — type live into the laptop (IME-safe diffing, so swipe-typing works), plus common shortcuts and **your own custom shortcut buttons** (any chord like `ctrl+shift+p`, or sequences like `ctrl+k,ctrl+o`).
- **Live screen view** — MJPEG stream with tap-to-click where you tap, a realtime client-predicted cursor overlay, a magnifier loupe, and quality presets.
- **Media & system** — play/pause/next/prev, volume, mute, brightness, battery readout.
- **Power** — lock, sleep, restart, shutdown, each with confirm + an abort window (grace period is configurable).
- **Settings screen** — everything below is tweakable from the phone itself.
- **PWA** — add to home screen and it feels like a native app.
- **Works from anywhere, not just home Wi-Fi** — optional: add [Tailscale](https://tailscale.com) (free) and control your laptop from the other side of the world, no port forwarding, no config. The agent detects it and shows a remote QR/URL automatically.

## Quick start

Requirements: Windows 10/11, [Node.js ≥ 20](https://nodejs.org), phone on the same Wi-Fi.

```powershell
git clone https://github.com/ronak-create/LapDeck.git
cd LapDeck
npm install
npm start
```

The terminal prints a QR code. Scan it with your phone — the UI opens already paired (the token rides in the link and is stored on the phone; you scan once). Then use your browser menu → **Add to Home screen**.

> **Phone can't connect?** Allow **Node.js** through Windows Firewall on **private networks** — the prompt appears on first run. That's the #1 cause.

### Run automatically at login (hidden, no console)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1
```

Drops a tiny launcher into your Startup folder (no admin needed). Manage it with `scripts\stop-agent.ps1` and `scripts\uninstall-autostart.ps1`. Autostart runs after you log in, because input injection and screen capture need your interactive session.

## Customization

Open the **⚙ Settings** screen on the phone (or edit `data/settings.json` on the laptop — see [docs/CONFIGURATION.md](docs/CONFIGURATION.md) for every key):

| Setting | What it does |
| --- | --- |
| Device name | Title shown in the app |
| Accent color | Theme, synced to every paired phone |
| Feature switches | Turn screen view / input / media / power / file browsing off entirely — **enforced by the agent**, not just hidden |
| Power permissions | Allow/deny sleep, shutdown, restart individually; shutdown grace period (0–60 s) |
| Custom shortcuts | Your own buttons on the Keyboard screen |
| Stream presets | fps / width / JPEG quality of the Low/Med/High screen presets (file only) |
| Port / bind address | `settings.json` or `LC_PORT` / `LC_BIND` env vars |
| Per-phone prefs | Haptics, natural scrolling, pointer speed (stored on the phone) |

## Security model

- Pairing is a random 256-bit token, generated on first run and embedded in the QR link. **Every command requires it** — over WebSocket (first message must authenticate, 3 s or the socket drops) and on the MJPEG stream. Token comparison is constant-time.
- Destructive actions (sleep/shutdown/restart) additionally require a `confirm` flag, must be enabled in settings, and shutdown/restart honor a grace period during which one tap aborts.
- Feature switches are enforced server-side: a disabled feature's commands are refused even if a client sends them.
- To re-pair from scratch (rotate the token), delete `data/secret.json` and restart.
- Transport is plain HTTP/WS on your LAN. That's fine for a home network you trust; for anything else use Tailscale, which encrypts end-to-end (WireGuard) and gives you a valid-HTTPS URL via MagicDNS. **Never port-forward the agent to the open internet.**

## Use it from anywhere (remote access)

Out of the box LapDeck works on your local network — phone and laptop on the same Wi-Fi, nothing leaves your house.

Want to control the laptop from work, a friend's place, or another country? Install [Tailscale](https://tailscale.com/download) (free for personal use) on the laptop and phone with the same account. That's the entire setup — no port forwarding, no dynamic DNS, no server to rent. Tailscale puts both devices on a private WireGuard-encrypted network, and LapDeck detects it automatically: the agent prints a second "remote" QR, and the UI's *Remote access* panel offers a one-tap switch plus an HTTPS URL (via MagicDNS/`tailscale cert`) that makes the PWA installable as a real app from anywhere.

Tailscale is entirely optional — LapDeck never needs the internet and has no cloud component. Any WireGuard/VPN setup that puts your phone on your home network works too; Tailscale is just the zero-config way. What you should **not** do is expose the agent's port directly to the internet — see the security model above.

## Project layout

```
src/
  index.js        HTTP + WebSocket server, QR pairing
  settings.js     defaults + data/settings.json (the customization layer)
  config.js       pairing token, launcher entries
  auth.js         constant-time token guards
  router.js       command dispatch + feature-switch enforcement
  stream.js       shared MJPEG capture loop (nut.js + sharp)
  handlers/       one module per command namespace (apps, input, media, …)
  win/            all Windows-specific PowerShell/CLI helpers
public/           the phone PWA (vanilla HTML/CSS/JS)
scripts/          autostart install/stop/uninstall (PowerShell)
data/             created at runtime: token, settings, launcher (gitignored)
```

The full WebSocket protocol is documented in [docs/PROTOCOL.md](docs/PROTOCOL.md) — it's deliberately simple JSON envelopes, so alternative clients (a native Android app, a CLI, an automation script) are easy to build.

## FAQ

**Why Windows-only?** All the OS glue (volume, brightness, power, capture) lives behind `src/win/`. Ports to macOS/Linux are welcome — the protocol and UI are OS-agnostic.

**Sleep hibernates instead?** Windows quirk: if hibernation is enabled, `SetSuspendState` hibernates. `powercfg /h off` if you prefer S3 sleep.

**Screen view shows the primary display only** — multi-monitor selection is on the wishlist.

**Does it work without internet?** Yes — everything is LAN-local. Internet is only involved if you use Tailscale.

## Contributing

Issues and PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Keep it dependency-light: plain modern JavaScript (ESM, Node ≥ 20), no TypeScript, no build step.

Found a security problem? Please report it privately — see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Ronak Parmar
