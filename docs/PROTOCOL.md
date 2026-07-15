# LapDeck WebSocket protocol

Everything except the static UI and the MJPEG stream flows over a single
WebSocket at **`ws://<host>:<port>/ws`**, as JSON envelopes:

```jsonc
// request  (client → agent)
{ "id": 42, "type": "media.volume", "payload": { "delta": 1 } }

// response (agent → client), matched by id
{ "id": 42, "ok": true,  "data": { } }
{ "id": 42, "ok": false, "error": "why it failed" }
```

## Authentication

The **first message** on a fresh socket must be an auth request; the agent
drops unauthenticated sockets after 3 seconds. The token comes from the
pairing QR (`#t=…` in the URL).

```jsonc
{ "id": 1, "type": "auth", "payload": { "token": "<64-hex pairing token>" } }
// → { "id": 1, "ok": true, "data": { "host": "LAPTOP-X", "version": "1.0.0" } }
```

Commands belonging to a feature disabled in settings return
`ok: false, error: "<feature> is disabled in settings"`.

## Commands

### apps — launcher tiles
| type | payload | data |
| --- | --- | --- |
| `apps.list` | — | `{ apps: [entry] }` |
| `apps.launch` | `{ id }` | `{ launched: id }` |
| `apps.add` | `{ label, kind: "exec"\|"folder"\|"file"\|"url", target, args?, browser?, icon? }` | `{ apps }` |
| `apps.remove` | `{ id }` | `{ apps }` |

### input — touchpad & keyboard (feature: `input`)
| type | payload | data |
| --- | --- | --- |
| `input.move` | `{ dx, dy }` relative px | `{}` |
| `input.moveTo` | `{ x, y }` absolute logical px | `{}` |
| `input.click` | `{ button?: "left"\|"right"\|"middle", double?: bool }` | `{}` |
| `input.down` / `input.up` | `{ button? }` (press/release for drags) | `{}` |
| `input.scroll` | `{ dy?, dx? }` positive = down/right | `{}` |
| `input.type` | `{ text }` unicode text | `{}` |
| `input.key` | `{ key, modifiers?: ["ctrl","alt","shift","win"] }` | `{}` |
| `input.cursor` | — | `{ x, y }` current pointer |

`key` accepts letters, digits, `f1`–`f12`, and names like `enter esc tab
backspace delete up down left right space home end pageup pagedown plus minus
win ctrl alt shift`.

### screen — live view (feature: `screen`)
| type | payload | data |
| --- | --- | --- |
| `screen.start` | `{ fps?, width?, quality? }` | `{ url: "/stream.mjpeg", screenW, screenH, config }` |
| `screen.stop` | — | `{}` |

Pixels flow over **`GET /stream.mjpeg?token=<token>`** —
`multipart/x-mixed-replace`, renders natively in an `<img>`. One shared
capture loop feeds all viewers; `screen.start` retunes it live. `screenW/H`
are logical (DPI-scaled) coordinates — the space `input.moveTo` uses.

### media — volume & transport (feature: `media`)
| type | payload | data |
| --- | --- | --- |
| `media.volume` | `{ delta: ±steps }` or `{ set: 0–100 }` | `{ level? }` |
| `media.mute` / `media.playpause` / `media.next` / `media.prev` | — | `{}` |

### system — info, brightness, power
| type | payload | data |
| --- | --- | --- |
| `system.info` | — | `{ hostname, deviceName, version, uptime, battery: { present, percent?, charging? }, brightness, volume, muted }` |
| `system.addresses` | — | `{ lan, tailscale, dns, port, httpsUrl }` |
| `system.brightness` | `{ level: 0–100 }` | `{ brightness }` |
| `system.lock` | — (feature: `power`) | `{}` |
| `system.sleep` | `{ confirm: true }` (feature + `allowSleep`) | `{}` |
| `system.shutdown` | `{ confirm: true }` (feature + `allowShutdown`) | `{ grace }` |
| `system.restart` | `{ confirm: true }` (feature + `allowRestart`) | `{ grace }` |
| `system.abort` | — cancels a pending shutdown/restart | `{}` |

### fs — file browsing (feature: `files`)
| type | payload | data |
| --- | --- | --- |
| `fs.list` | `{ path? }` (defaults to home) | `{ path, parent, items: [{ name, path, isDir, size }] }` |
| `fs.open` | `{ path }` opens in Explorer/default app | `{ opened }` |

### settings — the customization layer
| type | payload | data |
| --- | --- | --- |
| `settings.get` | — | `{ settings, defaults }` |
| `settings.set` | partial patch, deep-merged | `{ settings, restartRequired }` |
| `settings.reset` | — | `{ settings }` |

See [CONFIGURATION.md](CONFIGURATION.md) for the settings schema.

## Housekeeping

- The agent pings every socket each 30 s and terminates ones that don't pong.
- Malformed frames are ignored; handler errors come back as `ok: false`
  envelopes — the agent never crashes on bad input.
- Clients should reconnect with backoff and re-auth; the reference PWA drops
  all pending requests on disconnect so stale input is never replayed.
