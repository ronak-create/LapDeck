# Configuration

Everything user-tunable lives in **`data/settings.json`**, deep-merged over built-in defaults — the file only needs the keys you actually changed. Most of it is editable from the phone's ⚙ Settings screen; the file covers the rest. Invalid values are clamped back into range on load.

The `data/` directory is created on first run and is gitignored (it also holds `secret.json`, the pairing token, and `apps.json`, the launcher tiles).

## Environment variables

| Variable | Effect |
| --- | --- |
| `LC_PORT` | Listen port; overrides `settings.port` |
| `LC_BIND` | Bind address; overrides `settings.bind` |
| `LC_DATA_DIR` | Relocate the whole data directory |

## Full `settings.json` reference (defaults shown)

```jsonc
{
  // Server — these two need an agent restart to apply.
  "port": 8765,
  "bind": "0.0.0.0",          // e.g. a Tailscale IP to listen on that interface only

  // Shown as the app title on the phone (empty = "LapDeck").
  "deviceName": "",

  // Synced UI theme. Any #rrggbb accent works, not just the built-in swatches.
  "theme": { "accent": "#4c8dff" },

  // Feature switches. A disabled feature's commands are REFUSED by the agent
  // (the UI hides them too, but the server is the enforcement point).
  "features": {
    "screen": true,   // live screen view + tap-to-click (+ /stream.mjpeg)
    "input": true,    // touchpad + keyboard injection
    "files": true,    // fs.* protocol commands (browse/open)
    "media": true,    // volume + transport keys
    "power": true     // lock / sleep / shutdown / restart
  },

  // Per-action power permissions (only consulted when features.power is on).
  "power": {
    "allowSleep": true,
    "allowShutdown": true,
    "allowRestart": true,
    "graceSeconds": 5          // 0–60; countdown during which one tap aborts
  },

  // Screen-view quality presets offered by the UI.
  // fps 1–15, width 480–2560, quality 20–90.
  "stream": {
    "presets": {
      "low":  { "fps": 2, "width": 960,  "quality": 45 },
      "med":  { "fps": 4, "width": 1280, "quality": 60 },
      "high": { "fps": 6, "width": 1600, "quality": 72 }
    }
  },

  // Custom buttons on the Keyboard screen. `keys` is a chord ("ctrl+shift+p")
  // or a comma-separated chord sequence ("ctrl+k,ctrl+o"). Max 30 entries.
  "shortcuts": [
    { "id": "a1b2c3d4", "label": "Command Palette", "keys": "ctrl+shift+p" }
  ]
}
```

## Launcher tiles (`data/apps.json`)

Managed from the phone (＋ tile to add, long-press to remove), but hand-editable:

```jsonc
[
  { "id": "chrome",  "label": "Chrome",  "kind": "exec",   "target": "chrome.exe", "args": [] },
  { "id": "proj",    "label": "Project", "kind": "folder", "target": "C:\\dev\\project" },
  { "id": "notes",   "label": "Notes",   "kind": "file",   "target": "C:\\notes.txt" },
  { "id": "yt",      "label": "YouTube", "kind": "url",    "target": "https://youtube.com",
    "browser": "chrome",            // optional: force a browser (resolved via App Paths)
    "icon": "youtube.svg" }         // optional: file under public/icons/ or an https URL
]
```

`kind: "exec"` targets resolve like the Run dialog (App Paths), so bare names
such as `code.exe` or `chrome.exe` work without full paths.

## Per-phone preferences

Stored in the phone's localStorage (not synced): haptic feedback, natural
scrolling direction, touchpad pointer speed. Set them from ⚙ Settings and the
Touchpad screen.

## Re-pairing / rotating the token

Delete `data/secret.json`, restart the agent, scan the fresh QR. Old phones are
locked out immediately.
