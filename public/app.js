// Phone client: WS connection with auth + reconnect, launcher, controls,
// and the settings screen (server-side settings + per-phone preferences).
(() => {
  "use strict";

  // --- token: read from URL hash on pairing, persist, then strip hash ---
  function readToken() {
    const m = location.hash.match(/t=([a-f0-9]+)/i);
    if (m) {
      localStorage.setItem("lc_token", m[1]);
      history.replaceState(null, "", location.pathname + location.search);
      return m[1];
    }
    return localStorage.getItem("lc_token") || "";
  }
  const TOKEN = readToken();

  // --- per-phone preferences (client-side only) ---
  let HAPTICS = localStorage.getItem("lc_haptics") !== "0";
  let NATSCROLL = localStorage.getItem("lc_natscroll") !== "0";

  // --- WS client with auto-reconnect and request/response matching ---
  let ws = null;
  let connected = false;
  let reconnectDelay = 1000;
  let nextId = 1;
  const pending = new Map();

  const dot = document.getElementById("dot");
  function setConnected(v) {
    connected = v;
    dot.className = "dot " + (v ? "on" : "off");
    dot.title = v ? "connected" : "disconnected";
  }

  function connect() {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}/ws`);

    ws.onopen = () => {
      // Authenticate first; only mark connected once the server accepts.
      send("auth", { token: TOKEN })
        .then(() => {
          setConnected(true);
          reconnectDelay = 1000;
          onReady();
        })
        .catch(() => {
          toast("Pairing failed — rescan the QR from the laptop", true);
          ws.close();
        });
    };

    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      const p = pending.get(msg.id);
      if (p) {
        pending.delete(msg.id);
        if (msg.ok) p.resolve(msg.data);
        else p.reject(new Error(msg.error || "error"));
      }
    };

    ws.onclose = () => {
      setConnected(false);
      // Drop pending requests (stale input must not be replayed).
      for (const p of pending.values()) p.reject(new Error("disconnected"));
      pending.clear();
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.6, 5000);
    };

    ws.onerror = () => { /* onclose will handle reconnect */ };
  }

  // Send a command, returns a promise for its response data.
  function send(type, payload) {
    return new Promise((resolve, reject) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        reject(new Error("not connected"));
        return;
      }
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, type, payload: payload || {} }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("timeout"));
        }
      }, 8000);
    });
  }

  // Fire a command, toast on error, ignore success (for buttons).
  function cmd(type, payload) {
    send(type, payload).catch((e) => toast(e.message, true));
  }

  // --- toast ---
  let toastTimer = null;
  const toastEl = document.getElementById("toast");
  function toast(text, isErr) {
    toastEl.textContent = text;
    toastEl.className = "toast" + (isErr ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2200);
  }

  // --- launcher grid ---
  const grid = document.getElementById("app-grid");
  // Pick a launcher icon: explicit entry.icon wins, else match the target/label
  // against known apps, else fall back to a per-kind default icon.
  const ICON_VER = "1"; // bump to bust the phone's cache when icons change
  function pickIcon(a) {
    if (a.icon) return a.icon.startsWith("http") ? a.icon : "icons/" + a.icon;
    const t = ((a.target || "") + " " + (a.label || "")).toLowerCase();
    if (/chrome/.test(t)) return "icons/chrome.svg";
    if (/vs ?code|code\.exe|visual studio code/.test(t)) return "icons/vscode.svg";
    if (/youtube|youtu\.be/.test(t)) return "icons/youtube.svg";
    if (/github/.test(t)) return "icons/github.svg";
    if (/download/.test(t)) return "icons/download.svg";
    if (a.kind === "folder") return "icons/folder.svg";
    if (a.kind === "url") return "icons/web.svg";
    if (a.kind === "file") return "icons/file.svg";
    return "icons/app.svg";
  }
  function iconFor(a) {
    const base = pickIcon(a);
    return base.startsWith("http") ? base : base + "?v=" + ICON_VER;
  }

  async function loadApps() {
    try {
      const { apps } = await send("apps.list");
      renderApps(apps);
    } catch (e) {
      toast("Couldn't load apps: " + e.message, true);
    }
  }

  function renderApps(apps) {
    grid.innerHTML = "";
    for (const a of apps) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.innerHTML = `<img class="ico" src="${iconFor(a)}" alt="" draggable="false" /><div class="lbl">${escapeHtml(a.label)}</div>`;
      tile.onclick = () => cmd("apps.launch", { id: a.id });
      // Long-press to remove.
      let lpTimer = null;
      tile.addEventListener("touchstart", () => {
        lpTimer = setTimeout(() => confirmRemove(a), 600);
      }, { passive: true });
      tile.addEventListener("touchend", () => clearTimeout(lpTimer));
      tile.addEventListener("touchmove", () => clearTimeout(lpTimer), { passive: true });
      grid.appendChild(tile);
    }
    const add = document.createElement("div");
    add.className = "tile add";
    add.innerHTML = `<div class="ico">＋</div><div class="lbl">Add</div>`;
    add.onclick = showAddSheet;
    grid.appendChild(add);
  }

  function confirmRemove(a) {
    openSheet("Remove app", `<div class="sheet-msg">Remove “${escapeHtml(a.label)}” from the launcher?</div>`, async () => {
      const { apps } = await send("apps.remove", { id: a.id });
      renderApps(apps);
      toast("Removed");
    });
  }

  // --- add-app sheet ---
  function showAddSheet() {
    const body = `
      <div class="sheet-body-field"><label>Label</label><input id="f-label" placeholder="e.g. VS Code" /></div>
      <div class="sheet-body-field"><label>Type</label>
        <select id="f-kind">
          <option value="exec">App (.exe)</option>
          <option value="folder">Folder</option>
          <option value="file">File</option>
          <option value="url">Website</option>
        </select>
      </div>
      <div class="sheet-body-field"><label>Target</label><input id="f-target" placeholder="code.exe / C:\\path / https://..." /></div>
      <div class="sheet-body-field"><label>Browser (websites only, optional)</label><input id="f-browser" placeholder="chrome / msedge / firefox — empty = default" /></div>`;
    openSheet("Add app", body, async () => {
      const label = document.getElementById("f-label").value.trim();
      const kind = document.getElementById("f-kind").value;
      const target = document.getElementById("f-target").value.trim();
      const browser = document.getElementById("f-browser").value.trim();
      if (!label || !target) { toast("Fill in label and target", true); throw new Error("incomplete"); }
      const entry = { label, kind, target };
      if (kind === "url" && browser) entry.browser = browser;
      const { apps } = await send("apps.add", entry);
      renderApps(apps);
      toast("Added");
    });
  }

  // --- generic sheet ---
  const sheet = document.getElementById("sheet");
  const sheetTitle = document.getElementById("sheet-title");
  const sheetBody = document.getElementById("sheet-body");
  const sheetOkBtn = document.getElementById("sheet-ok");
  let sheetOk = null;

  function openSheet(title, bodyHtml, onOk, okLabel) {
    sheetTitle.textContent = title;
    sheetBody.innerHTML = bodyHtml;
    sheetOkBtn.textContent = okLabel || "OK";
    sheetOk = onOk;
    sheet.classList.remove("hidden");
  }
  function closeSheet() { sheet.classList.add("hidden"); sheetOk = null; }
  document.getElementById("sheet-cancel").onclick = closeSheet;
  sheetOkBtn.onclick = async () => {
    if (!sheetOk) return closeSheet();
    try { await sheetOk(); closeSheet(); }
    catch (e) { if (e.message !== "incomplete") toast(e.message, true); }
  };
  sheet.addEventListener("click", (e) => { if (e.target === sheet) closeSheet(); });

  // --- control buttons ---
  document.querySelectorAll("[data-act]").forEach((el) => {
    el.addEventListener("click", () => {
      const act = el.dataset.act;
      switch (act) {
        case "vol-up": cmd("media.volume", { delta: 1 }); break;
        case "vol-down": cmd("media.volume", { delta: -1 }); break;
        case "mute": cmd("media.mute"); break;
        case "playpause": cmd("media.playpause"); break;
        case "next": cmd("media.next"); break;
        case "prev": cmd("media.prev"); break;
        case "lock": cmd("system.lock"); break;
        case "sleep":
          openSheet("Sleep laptop", `<div class="sheet-msg">Put the laptop to sleep now?</div>`,
            async () => { await send("system.sleep", { confirm: true }); toast("Sleeping…"); });
          break;
        case "restart": confirmPower("restart", "Restart"); break;
        case "shutdown": confirmPower("shutdown", "Shut down"); break;
      }
    });
  });

  // Shutdown/restart: confirm, then offer a one-tap abort during the grace window.
  function confirmPower(kind, label) {
    const grace = (SETTINGS && SETTINGS.power.graceSeconds) || 5;
    openSheet(label, `<div class="sheet-msg">${label} in ${grace} seconds after you confirm. You can abort during the countdown.</div>`,
      async () => {
        const res = await send("system." + kind, { confirm: true });
        setTimeout(() => {
          openSheet(`${label} in ${res.grace}s`,
            `<div class="sheet-msg">The laptop is going down. Abort?</div>`,
            async () => { await send("system.abort"); toast("Aborted"); },
            "Abort");
        }, 50); // reopen after this sheet closes
      });
  }

  // --- brightness slider (debounced) ---
  const bright = document.getElementById("bright");
  const brightVal = document.getElementById("bright-val");
  let brightTimer = null;
  bright.addEventListener("input", () => {
    brightVal.textContent = bright.value + "%";
    clearTimeout(brightTimer);
    brightTimer = setTimeout(() => cmd("system.brightness", { level: Number(bright.value) }), 150);
  });

  // --- system info ---
  const sysinfo = document.getElementById("sysinfo");
  const titleEl = document.getElementById("app-title");
  async function refreshInfo() {
    try {
      const info = await send("system.info");
      const bits = [];
      if (info.hostname) bits.push(info.hostname);
      if (info.battery?.present) bits.push(`🔋 ${info.battery.percent}%${info.battery.charging ? " ⚡" : ""}`);
      if (info.volume != null) bits.push(`🔊 ${info.muted ? "muted" : info.volume + "%"}`);
      sysinfo.textContent = bits.join("   ·   ");
      if (info.brightness != null) { bright.value = info.brightness; brightVal.textContent = info.brightness + "%"; }
    } catch { /* ignore transient info failures */ }
  }

  // --- remote access (Tailscale) panel ---
  const remoteBody = document.getElementById("remote-body");
  async function refreshRemote() {
    if (!remoteBody) return;
    try {
      const { lan, tailscale, port, httpsUrl } = await send("system.addresses");
      const onSecure = httpsUrl && ("https://" + location.hostname) === httpsUrl;
      let html = `<div class="remote-row"><span>Home Wi-Fi</span><span class="addr">${lan}:${port}</span></div>`;
      if (tailscale) {
        html += `<div class="remote-row"><span>Remote (Tailscale)</span><span class="addr">${tailscale}:${port}</span></div>`;
      }
      if (httpsUrl) {
        // The secure HTTPS origin — the one to install as a real app.
        html += `<div class="remote-row"><span>Secure app ${onSecure ? '<span class="remote-tag">active ✓</span>' : ""}</span>` +
                `<span class="addr">${httpsUrl.replace("https://", "")}</span></div>`;
        if (!onSecure) {
          html += `<div class="remote-row"><span class="muted">Open the secure app, then Add to Home screen →</span>` +
                  `<button class="remote-open" id="remote-secure">Open</button></div>`;
        } else {
          html += `<div class="remote-row"><span class="remote-tag" style="font-size:12px">You're on the secure app — Add to Home screen to install it.</span></div>`;
        }
      } else if (tailscale) {
        html += `<div class="remote-row"><span class="muted">Pair for remote →</span><button class="remote-open" id="remote-open">Open</button></div>`;
      } else {
        html += `<div class="remote-off" style="margin-top:6px">Off — install Tailscale on this laptop and your phone (same account) to control it from anywhere.</div>`;
      }
      remoteBody.innerHTML = html;
      const btn = document.getElementById("remote-open");
      if (btn) btn.onclick = () => { location.href = `http://${tailscale}:${port}/#t=${encodeURIComponent(TOKEN)}`; };
      const sbtn = document.getElementById("remote-secure");
      if (sbtn) sbtn.onclick = () => { location.href = `${httpsUrl}/#t=${encodeURIComponent(TOKEN)}`; };
    } catch {
      remoteBody.textContent = "Remote info unavailable";
    }
  }

  function onReady() {
    loadSettings();
    loadApps();
    refreshInfo();
    refreshRemote();
    // If the Screen tab is open when we (re)connect, resume the stream — its
    // MJPEG connection dies with the socket drop and won't come back on its own.
    if (typeof currentScreen !== "undefined" && currentScreen === "view") startScreen();
  }

  // ===================== settings =====================
  let SETTINGS = null;

  async function loadSettings() {
    try {
      const { settings } = await send("settings.get");
      applySettings(settings);
    } catch { /* older agent without settings support: run with UI defaults */ }
  }

  // Push a partial patch, then re-apply whatever the server settled on.
  async function saveSettings(patch) {
    try {
      const { settings, restartRequired } = await send("settings.set", patch);
      applySettings(settings);
      if (restartRequired) toast("Saved — restart the agent to apply port/bind");
    } catch (e) {
      toast("Couldn't save: " + e.message, true);
    }
  }

  function applySettings(s) {
    SETTINGS = s;

    // Theme + title
    document.documentElement.style.setProperty("--accent", s.theme.accent);
    titleEl.textContent = s.deviceName || "LapDeck";
    document.querySelectorAll(".swatch").forEach((el) =>
      el.classList.toggle("active", el.dataset.accent.toLowerCase() === s.theme.accent.toLowerCase()));

    // Feature visibility. The server refuses disabled commands regardless.
    document.querySelectorAll("[data-feature]").forEach((el) => {
      el.style.display = s.features[el.dataset.feature] === false ? "none" : "";
    });
    const tabNeeds = { pad: "input", keys: "input", view: "screen" };
    document.querySelectorAll(".tab").forEach((tab) => {
      const need = tabNeeds[tab.dataset.screen];
      const visible = !need || s.features[need] !== false;
      tab.style.display = visible ? "" : "none";
      if (!visible && currentScreen === tab.dataset.screen) switchScreen("launcher");
    });

    // Per-action power buttons
    document.getElementById("btn-sleep").style.display = s.power.allowSleep ? "" : "none";
    document.getElementById("btn-shutdown").style.display = s.power.allowShutdown ? "" : "none";
    document.getElementById("btn-restart").style.display = s.power.allowRestart ? "" : "none";

    // Stream presets straight from settings
    PRESETS = s.stream.presets;

    // Settings screen controls
    setName.value = s.deviceName;
    for (const k of ["screen", "input", "media", "power", "files"]) {
      document.getElementById("feat-" + k).checked = s.features[k] !== false;
    }
    document.getElementById("pow-sleep").checked = s.power.allowSleep;
    document.getElementById("pow-shutdown").checked = s.power.allowShutdown;
    document.getElementById("pow-restart").checked = s.power.allowRestart;
    grace.value = s.power.graceSeconds;
    graceVal.textContent = s.power.graceSeconds + "s";
    document.getElementById("about").textContent = "LapDeck · open source · settings sync to every paired phone";

    renderShortcuts(s.shortcuts);
  }

  // --- settings screen wiring ---
  const setName = document.getElementById("set-name");
  const grace = document.getElementById("grace");
  const graceVal = document.getElementById("grace-val");

  let nameTimer = null;
  setName.addEventListener("input", () => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => saveSettings({ deviceName: setName.value.trim() }), 600);
  });

  document.querySelectorAll(".swatch").forEach((el) => {
    el.addEventListener("click", () => saveSettings({ theme: { accent: el.dataset.accent } }));
  });

  for (const k of ["screen", "input", "media", "power", "files"]) {
    document.getElementById("feat-" + k).addEventListener("change", (e) =>
      saveSettings({ features: { [k]: e.target.checked } }));
  }
  document.getElementById("pow-sleep").addEventListener("change", (e) => saveSettings({ power: { allowSleep: e.target.checked } }));
  document.getElementById("pow-shutdown").addEventListener("change", (e) => saveSettings({ power: { allowShutdown: e.target.checked } }));
  document.getElementById("pow-restart").addEventListener("change", (e) => saveSettings({ power: { allowRestart: e.target.checked } }));

  let graceTimer = null;
  grace.addEventListener("input", () => {
    graceVal.textContent = grace.value + "s";
    clearTimeout(graceTimer);
    graceTimer = setTimeout(() => saveSettings({ power: { graceSeconds: Number(grace.value) } }), 300);
  });

  // Per-phone preferences (localStorage, not synced)
  const prefHaptics = document.getElementById("pref-haptics");
  const prefNat = document.getElementById("pref-natscroll");
  prefHaptics.checked = HAPTICS;
  prefNat.checked = NATSCROLL;
  prefHaptics.addEventListener("change", () => {
    HAPTICS = prefHaptics.checked;
    localStorage.setItem("lc_haptics", HAPTICS ? "1" : "0");
  });
  prefNat.addEventListener("change", () => {
    NATSCROLL = prefNat.checked;
    localStorage.setItem("lc_natscroll", NATSCROLL ? "1" : "0");
  });

  document.getElementById("set-reset").addEventListener("click", () => {
    openSheet("Reset settings", `<div class="sheet-msg">Reset every setting (theme, features, power, shortcuts) to defaults?</div>`, async () => {
      const { settings } = await send("settings.reset");
      applySettings(settings);
      toast("Settings reset");
    }, "Reset");
  });

  // --- custom shortcuts (synced via settings) ---
  const scGrid = document.getElementById("my-shortcuts");
  function renderShortcuts(list) {
    scGrid.innerHTML = "";
    for (const sc of list) {
      const b = document.createElement("button");
      b.className = "btn";
      b.textContent = sc.label;
      b.dataset.seq = sc.keys; // the generic data-seq handler fires it
      let lpTimer = null;
      b.addEventListener("touchstart", () => {
        lpTimer = setTimeout(() => confirmRemoveShortcut(sc), 600);
      }, { passive: true });
      b.addEventListener("touchend", () => clearTimeout(lpTimer));
      b.addEventListener("touchmove", () => clearTimeout(lpTimer), { passive: true });
      scGrid.appendChild(b);
    }
    const add = document.createElement("button");
    add.className = "btn add-sc";
    add.textContent = "＋ Add";
    add.onclick = showAddShortcut;
    scGrid.appendChild(add);
  }

  function confirmRemoveShortcut(sc) {
    openSheet("Remove shortcut", `<div class="sheet-msg">Remove “${escapeHtml(sc.label)}”?</div>`, async () => {
      await saveSettings({ shortcuts: SETTINGS.shortcuts.filter((x) => x.id !== sc.id) });
      toast("Removed");
    }, "Remove");
  }

  function showAddShortcut() {
    const body = `
      <div class="sheet-body-field"><label>Label</label><input id="sc-label" maxlength="24" placeholder="e.g. Command Palette" /></div>
      <div class="sheet-body-field"><label>Keys — chord like ctrl+shift+p, or a sequence like ctrl+k,ctrl+o</label>
        <input id="sc-keys" placeholder="ctrl+shift+p" autocapitalize="off" autocorrect="off" /></div>`;
    openSheet("Add shortcut", body, async () => {
      const label = document.getElementById("sc-label").value.trim();
      const keys = document.getElementById("sc-keys").value.trim().toLowerCase();
      if (!label || !keys) { toast("Fill in label and keys", true); throw new Error("incomplete"); }
      await saveSettings({ shortcuts: [...(SETTINGS?.shortcuts || []), { label, keys }] });
      toast("Added");
    }, "Add");
  }

  // ===================== input =====================

  // --- generic action buttons (touchpad + keyboard screens) ---
  function haptic(ms) {
    if (!HAPTICS) return;
    try { navigator.vibrate && navigator.vibrate(ms || 8); } catch { /* ignore */ }
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-key],[data-click],[data-combo],[data-seq]");
    if (!el) return;
    if (el.dataset.click) {
      cmd("input.click", { button: el.dataset.click });
      haptic();
    } else if (el.dataset.key) {
      cmd("input.key", { key: el.dataset.key });
      haptic();
    } else if (el.dataset.combo) {
      const parts = el.dataset.combo.split("+");
      const key = parts.pop();
      cmd("input.key", { key, modifiers: parts });
      haptic();
    } else if (el.dataset.seq) {
      // Chord sequence (e.g. VS Code "ctrl+k,ctrl+o"): fire each chord in order.
      for (const combo of el.dataset.seq.split(",")) {
        const parts = combo.trim().split("+");
        const key = parts.pop();
        cmd("input.key", { key, modifiers: parts });
      }
      haptic();
    }
  });

  // --- touchpad gestures ---
  let SENS = parseFloat(localStorage.getItem("lc_sens")) || 3.5; // user-tunable base speed
  const ACCEL = 0.05;         // acceleration: fast flicks travel proportionally farther
  const TAP_MS = 250;         // max duration for a tap
  const TAP_MOVE = 10;        // max px travel to still count as a tap
  const SCROLL_DIV = 8;       // px of two-finger travel per scroll unit
  const DBL_MS = 320;         // window for double-tap-hold to start a drag

  // Scroll direction honoring the natural-scrolling preference. "Natural" means
  // finger up = content scrolls up (the phone-native feel), which maps to a
  // negative dy for a positive finger delta.
  function scrollUnits(units) {
    return NATSCROLL ? -units : units;
  }

  const sens = document.getElementById("sens");
  const sensVal = document.getElementById("sens-val");
  if (sens) {
    sens.value = SENS;
    sensVal.textContent = SENS + "×";
    sens.addEventListener("input", () => {
      SENS = parseFloat(sens.value);
      sensVal.textContent = SENS + "×";
      localStorage.setItem("lc_sens", String(SENS));
    });
  }

  function initPad(pad, opts = {}) {
    if (!pad) return;
    let mode = null;          // "move" | "scroll"
    let sx = 0, sy = 0, st = 0, lx = 0, ly = 0, moved = false;
    let scrollBaseY = 0, scrollMoved = false, twoStart = 0;
    let dragging = false, lastTap = 0;

    // coalesce moves to one send per animation frame
    let accDx = 0, accDy = 0, rafPending = false;
    function flushMove() {
      rafPending = false;
      if (accDx || accDy) {
        const dx = Math.round(accDx), dy = Math.round(accDy);
        cmd("input.move", { dx, dy });
        // Move the overlay by the EXACT integer sent to the server (not the raw
        // fractional finger delta) so the two never drift out of sync.
        if (opts.onMove) opts.onMove(dx, dy);
        accDx = 0; accDy = 0;
      }
    }
    function queueMove(dx, dy) {
      accDx += dx; accDy += dy;
      if (!rafPending) { rafPending = true; requestAnimationFrame(flushMove); }
    }

    pad.addEventListener("touchstart", (e) => {
      e.preventDefault();
      pad.classList.add("active");
      const n = e.touches.length;
      if (n === 1) {
        const t = e.touches[0];
        sx = lx = t.clientX; sy = ly = t.clientY; st = Date.now(); moved = false; mode = "move";
        // double-tap-and-hold → begin drag
        if (Date.now() - lastTap < DBL_MS) { dragging = true; cmd("input.down", { button: "left" }); haptic(12); }
      } else if (n === 2) {
        mode = "scroll"; scrollMoved = false; twoStart = Date.now();
        scrollBaseY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      }
    }, { passive: false });

    pad.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (mode === "move" && e.touches.length === 1) {
        const t = e.touches[0];
        const rawDx = t.clientX - lx, rawDy = t.clientY - ly;
        const gain = SENS * (1 + Math.hypot(rawDx, rawDy) * ACCEL);
        queueMove(rawDx * gain, rawDy * gain);
        lx = t.clientX; ly = t.clientY;
        if (Math.abs(t.clientX - sx) > TAP_MOVE || Math.abs(t.clientY - sy) > TAP_MOVE) moved = true;
      } else if (mode === "scroll" && e.touches.length >= 2) {
        const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const d = y - scrollBaseY;
        if (Math.abs(d) > SCROLL_DIV) {
          scrollMoved = true;
          const units = Math.round(d / SCROLL_DIV);
          cmd("input.scroll", { dy: scrollUnits(units) });
          scrollBaseY = y;
        }
      }
    }, { passive: false });

    pad.addEventListener("touchend", (e) => {
      e.preventDefault();
      const remaining = e.touches.length;
      if (remaining > 0) return; // wait until all fingers lift

      pad.classList.remove("active");
      if (dragging) { cmd("input.up", { button: "left" }); dragging = false; haptic(); mode = null; return; }

      if (mode === "move" && !moved && Date.now() - st < TAP_MS) {
        cmd("input.click", { button: "left" }); lastTap = Date.now(); haptic();
      } else if (mode === "scroll" && !scrollMoved && Date.now() - twoStart < TAP_MS) {
        cmd("input.click", { button: "right" }); haptic();
      }
      mode = null; moved = false;
    }, { passive: false });
  }
  // Main touchpad screen + the compact pad on the Screen view. The screen pad
  // drives a client-drawn cursor overlay so the pointer tracks in realtime.
  initPad(document.getElementById("pad"));
  initPad(document.getElementById("pad-screen"), { onMove: moveCursorBy });

  // --- realtime cursor overlay for the Screen view ---
  // The MJPEG frames don't contain the OS cursor, and baking one in would move
  // only at frame rate (laggy). Instead we predict the pointer position on the
  // phone: every touchpad delta shifts the overlay instantly, and we reconcile
  // against the real position with a low-rate poll to correct any drift.
  const cursorEl = document.getElementById("screen-cursor");
  const screenWrap = document.getElementById("screen-wrap");
  let curX = 0, curY = 0;        // predicted pointer, in logical screen coords
  let lastCursorMoveT = 0;       // when the user last drove the cursor
  let reconcileTimer = null;

  function renderCursor() {
    if (!cursorEl || !img || !scrW || !scrH) return;
    const ir = img.getBoundingClientRect();
    const wr = screenWrap.getBoundingClientRect();
    const x = ir.left - wr.left + (curX / scrW) * ir.width;
    const y = ir.top - wr.top + (curY / scrH) * ir.height;
    cursorEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  // --- magnifier loupe: a live zoomed crop of the frame around the cursor ---
  const loupeEl = document.getElementById("screen-loupe");
  const loupeCtx = loupeEl ? loupeEl.getContext("2d") : null;
  const LOUPE_CSS = 96;    // on-screen diameter (matches CSS)
  const LOUPE_PX = 192;    // canvas backing resolution (2× for crispness)
  const LOUPE_ZOOM = 2.4;  // magnification relative to the screen-view image
  let loupeRAF = null, lastLoupeT = 0;

  function drawLoupe() {
    if (!loupeCtx || !img || !img.naturalWidth || !scrW || !scrH) return;
    const ir = img.getBoundingClientRect();
    if (!ir.width) return;
    // Cursor in the frame's own pixels, and how many frame px to sample so the
    // crop fills the loupe at LOUPE_ZOOM.
    const nx = (curX / scrW) * img.naturalWidth;
    const ny = (curY / scrH) * img.naturalHeight;
    const natPerDisp = img.naturalWidth / ir.width;
    const sw = (LOUPE_CSS / LOUPE_ZOOM) * natPerDisp;
    const sx = nx - sw / 2, sy = ny - sw / 2;
    loupeCtx.clearRect(0, 0, LOUPE_PX, LOUPE_PX);
    loupeCtx.imageSmoothingEnabled = true;
    try { loupeCtx.drawImage(img, sx, sy, sw, sw, 0, 0, LOUPE_PX, LOUPE_PX); }
    catch { return; } // off-frame source can throw on some engines
    // crosshair marking the exact hovered point
    const c = LOUPE_PX / 2;
    loupeCtx.strokeStyle = "rgba(255,70,70,0.9)";
    loupeCtx.lineWidth = 2;
    loupeCtx.beginPath();
    loupeCtx.moveTo(c - 12, c); loupeCtx.lineTo(c - 3, c);
    loupeCtx.moveTo(c + 3, c); loupeCtx.lineTo(c + 12, c);
    loupeCtx.moveTo(c, c - 12); loupeCtx.lineTo(c, c - 3);
    loupeCtx.moveTo(c, c + 3); loupeCtx.lineTo(c, c + 12);
    loupeCtx.stroke();
  }
  function positionLoupe() {
    if (!loupeEl || !img || !scrW) return;
    const ir = img.getBoundingClientRect();
    const wr = screenWrap.getBoundingClientRect();
    const px = ir.left - wr.left + (curX / scrW) * ir.width;
    const py = ir.top - wr.top + (curY / scrH) * ir.height;
    let lx = px - LOUPE_CSS / 2;      // centered over the cursor
    let ly = py - LOUPE_CSS - 16;     // floated above it by default
    if (ly < 4) ly = py + 16;         // no room above → drop below
    lx = Math.max(4, Math.min(wr.width - LOUPE_CSS - 4, lx));
    loupeEl.style.transform = `translate(${lx}px, ${ly}px)`;
  }
  function loupeLoop(t) {
    if (!streaming || !loupeEl || loupeEl.classList.contains("hidden")) { loupeRAF = null; return; }
    if (t - lastLoupeT > 45) { drawLoupe(); positionLoupe(); lastLoupeT = t; } // ~20fps
    loupeRAF = requestAnimationFrame(loupeLoop);
  }
  function startLoupe() {
    if (!loupeEl) return;
    loupeEl.classList.remove("hidden");
    if (!loupeRAF) loupeRAF = requestAnimationFrame(loupeLoop);
  }
  function stopLoupe() {
    if (loupeEl) loupeEl.classList.add("hidden");
    if (loupeRAF) { cancelAnimationFrame(loupeRAF); loupeRAF = null; }
  }
  function setCursor(x, y) {
    curX = Math.max(0, Math.min(scrW, x));
    curY = Math.max(0, Math.min(scrH, y));
    renderCursor();
  }
  function moveCursorBy(dx, dy) {
    lastCursorMoveT = Date.now();
    setCursor(curX + dx, curY + dy);
  }
  function markCursor(x, y) { lastCursorMoveT = Date.now(); setCursor(x, y); }
  async function reconcileCursor() {
    if (!streaming || Date.now() - lastCursorMoveT < 300) return; // don't fight a drag
    try {
      const p = await send("input.cursor");
      if (Date.now() - lastCursorMoveT >= 300) setCursor(p.x, p.y);
    } catch { /* transient: ignore */ }
  }
  window.addEventListener("resize", renderCursor);

  // --- keyboard relay (IME-safe: diff the field, don't rely on keydown) ---
  const kbd = document.getElementById("kbd");
  if (kbd) {
    let lastVal = "";
    let chain = Promise.resolve(); // keep relayed edits in order

    function relay(newVal) {
      if (newVal === lastVal) return;
      const oldVal = lastVal;
      // longest common prefix + suffix → send only the difference
      let i = 0;
      while (i < oldVal.length && i < newVal.length && oldVal[i] === newVal[i]) i++;
      let j = 0;
      while (j < oldVal.length - i && j < newVal.length - i &&
             oldVal[oldVal.length - 1 - j] === newVal[newVal.length - 1 - j]) j++;
      const removed = oldVal.length - i - j;
      const added = newVal.slice(i, newVal.length - j);
      lastVal = newVal;
      chain = chain.then(async () => {
        for (let k = 0; k < removed; k++) await send("input.key", { key: "backspace" }).catch(() => {});
        if (added) await send("input.type", { text: added }).catch(() => {});
      });
    }

    kbd.addEventListener("input", () => relay(kbd.value));

    // Enter goes to the laptop (after any pending typed text), then the phone
    // field clears for the next line — like a chat box. Clearing the field
    // programmatically does NOT fire 'input', so no phantom backspaces are sent.
    function sendEnter() {
      chain = chain.then(() => send("input.key", { key: "enter" }).catch(() => {}));
      kbd.value = ""; lastVal = ""; kbd.focus();
    }
    kbd.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); sendEnter(); }
    });
    document.getElementById("kbd-enter").addEventListener("click", sendEnter);
    document.getElementById("kbd-clear").addEventListener("click", () => {
      kbd.value = ""; lastVal = ""; kbd.focus();
    });
  }

  // --- screen view (MJPEG + tap-to-click) ---
  // Presets are replaced by settings.stream.presets once settings load.
  let PRESETS = {
    low: { fps: 2, width: 960, quality: 45 },
    med: { fps: 4, width: 1280, quality: 60 },
    high: { fps: 6, width: 1600, quality: 72 },
  };
  const img = document.getElementById("screen-img");
  const scrStatus = document.getElementById("screen-status");
  let curPreset = "med";
  let scrW = 0, scrH = 0, streaming = false;

  async function startScreen() {
    if (!img) return;
    scrStatus.style.display = "";
    scrStatus.textContent = "Connecting to screen…";
    try {
      const { screenW, screenH } = await send("screen.start", PRESETS[curPreset]);
      scrW = screenW; scrH = screenH; streaming = true;
      img.onload = () => { scrStatus.style.display = "none"; renderCursor(); };
      img.onerror = () => { scrStatus.style.display = ""; scrStatus.textContent = "Stream error — reopen this tab"; };
      img.src = `/stream.mjpeg?token=${encodeURIComponent(TOKEN)}&_=${Date.now()}`;
      // Realtime cursor overlay: seed from the true pointer, then reconcile.
      if (cursorEl) {
        cursorEl.classList.remove("hidden");
        try { const p = await send("input.cursor"); curX = p.x; curY = p.y; } catch { /* ignore */ }
        renderCursor();
        startLoupe();
        if (!reconcileTimer) reconcileTimer = setInterval(reconcileCursor, 250);
      }
    } catch (e) {
      scrStatus.textContent = "Screen unavailable: " + e.message;
    }
  }
  function stopScreen() {
    streaming = false;
    if (img) { img.removeAttribute("src"); } // aborts the MJPEG connection → loop stops
    if (cursorEl) cursorEl.classList.add("hidden");
    stopLoupe();
    if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; }
    send("screen.stop").catch(() => {});
  }

  if (img) {
    // quality presets — update the shared loop live, no need to reload the img
    document.querySelectorAll(".preset").forEach((b) => {
      b.addEventListener("click", () => {
        document.querySelectorAll(".preset").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        curPreset = b.dataset.preset;
        if (streaming) send("screen.start", PRESETS[curPreset]).catch(() => {});
      });
    });

    // map a tap on the image to absolute screen coords, then move + click
    function clickAt(cx, cy, button) {
      const r = img.getBoundingClientRect();
      const fx = (cx - r.left) / r.width, fy = (cy - r.top) / r.height;
      if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return;
      const x = Math.round(fx * scrW), y = Math.round(fy * scrH);
      markCursor(x, y);
      send("input.moveTo", { x, y }).then(() => send("input.click", { button })).catch(() => {});
    }

    // Quick tap = click, long-press = right-click, single-finger drag = scroll
    // (the drag targets the window under where the drag began).
    const SCR_DIV = 10; // px of finger travel per scroll unit
    let pressTimer = null, pressed = false, longFired = false, scrolling = false;
    let px = 0, py = 0, lastScrollY = 0;

    img.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]; px = t.clientX; py = t.clientY; lastScrollY = t.clientY;
      pressed = true; longFired = false; scrolling = false;
      pressTimer = setTimeout(() => { if (!scrolling) { longFired = true; clickAt(px, py, "right"); haptic(12); } }, 500);
    }, { passive: true });

    img.addEventListener("touchmove", (e) => {
      const t = e.touches[0];
      if (!scrolling && (Math.abs(t.clientX - px) > 12 || Math.abs(t.clientY - py) > 12)) {
        scrolling = true; pressed = false; clearTimeout(pressTimer);
        // aim the scroll at the point where the drag started
        const r = img.getBoundingClientRect();
        const fx = (px - r.left) / r.width, fy = (py - r.top) / r.height;
        if (fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1) {
          const x = Math.round(fx * scrW), y = Math.round(fy * scrH);
          markCursor(x, y);
          send("input.moveTo", { x, y }).catch(() => {});
        }
      }
      if (scrolling) {
        const d = t.clientY - lastScrollY;
        if (Math.abs(d) > SCR_DIV) {
          send("input.scroll", { dy: scrollUnits(Math.round(d / SCR_DIV)) }).catch(() => {});
          lastScrollY = t.clientY;
        }
      }
    }, { passive: true });

    img.addEventListener("touchend", () => {
      clearTimeout(pressTimer);
      if (pressed && !longFired && !scrolling) { clickAt(px, py, "left"); haptic(); }
      pressed = false; scrolling = false;
    }, { passive: true });
  }

  // --- tab bar + settings screen ---
  let currentScreen = "launcher";
  const gearBtn = document.getElementById("gear");

  function switchScreen(target) {
    if (target === currentScreen) return;
    document.querySelectorAll(".tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.screen === target));
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById("screen-" + target);
    if (el) el.classList.add("active");
    gearBtn.classList.toggle("active", target === "settings");
    if (currentScreen === "view") stopScreen();
    currentScreen = target;
    if (target === "view") startScreen();
  }

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchScreen(tab.dataset.screen));
  });
  gearBtn.addEventListener("click", () =>
    switchScreen(currentScreen === "settings" ? "launcher" : "settings"));

  // Pause the stream when the phone is backgrounded/locked; resume on return.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { if (streaming) stopScreen(); }
    else if (currentScreen === "view" && connected) startScreen();
  });

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  // Refresh info periodically while connected.
  setInterval(() => { if (connected) refreshInfo(); }, 15000);

  if (!TOKEN) {
    toast("No pairing token — scan the QR shown on the laptop", true);
  } else {
    connect();
  }

  // Register the service worker (only takes effect over HTTPS/localhost — that's
  // what upgrades "add to home screen" into a real standalone app).
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => { /* http origin: ignored */ });
  }
})();
