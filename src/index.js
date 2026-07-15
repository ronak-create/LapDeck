// Agent entry point: HTTP (static UI) + WebSocket command server + QR pairing.
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import express from "express";
import { WebSocketServer } from "ws";
import qrcode from "qrcode-terminal";

import { PORT, BIND, VERSION, loadToken, lanAddress } from "./config.js";
import { DATA_DIR, featureEnabled } from "./settings.js";
import { setToken, tokenValid, httpAuth } from "./auth.js";
import { dispatch } from "./router.js";
import { addViewer, removeViewer } from "./stream.js";
import { getTailscaleIp } from "./win/network.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, "..", "public");

const token = loadToken();
setToken(token);

const app = express();

// Token-gated MJPEG stream. multipart/x-mixed-replace renders natively in an
// <img>. Registered before static so the query-token guard applies.
app.get("/stream.mjpeg", httpAuth, (req, res) => {
  if (!featureEnabled("screen")) {
    res.status(403).type("text/plain").send("screen view is disabled in settings");
    return;
  }
  res.writeHead(200, {
    "Content-Type": "multipart/x-mixed-replace; boundary=frame",
    "Cache-Control": "no-cache, no-store, must-revalidate",
    Pragma: "no-cache",
    Connection: "close",
  });
  addViewer(res);
  log("stream open", req.socket.remoteAddress);
  const done = () => { removeViewer(res); log("stream close", req.socket.remoteAddress); };
  req.on("close", done);
  res.on("error", done);
});

app.use(express.static(PUBLIC_DIR)); // the only unauthenticated route: the UI itself

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  let authed = false;

  // Heartbeat: mark alive on pong; the interval below reaps silent sockets.
  ws.isAlive = true;
  ws.on("pong", () => { ws.isAlive = true; });

  // Must authenticate within 3s or the socket is dropped.
  const authTimer = setTimeout(() => {
    if (!authed) {
      log("auth timeout", ip);
      ws.close();
    }
  }, 3000);

  ws.on("message", async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      // Malformed frame must never crash the agent; just ignore it.
      return;
    }

    if (!authed) {
      if (msg.type === "auth" && tokenValid(msg.payload?.token)) {
        authed = true;
        clearTimeout(authTimer);
        log("auth ok", ip);
        ws.send(JSON.stringify({ id: msg.id, ok: true, data: { host: process.env.COMPUTERNAME || "laptop", version: VERSION } }));
      } else {
        log("auth fail", ip);
        ws.send(JSON.stringify({ id: msg?.id, ok: false, error: "unauthorized" }));
        ws.close();
      }
      return;
    }

    const response = await dispatch(msg);
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(response));
  });

  ws.on("error", (e) => log("ws error", ip, e.message));
});

// Every 30s, ping clients and terminate any that didn't pong since last check.
const heartbeat = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 30000);
wss.on("close", () => clearInterval(heartbeat));

// If the agent is already running (e.g. autostart + a manual start), exit
// cleanly instead of crashing. The listen error surfaces on BOTH the http
// server and the attached WebSocket server, so guard both.
function onFatal(err) {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use — the agent is probably already running.`);
    console.error("Nothing to do; exiting this instance.\n");
    process.exit(0);
  }
  console.error("Server error:", err.message);
  process.exit(1);
}
server.on("error", onFatal);
wss.on("error", onFatal);

// Record our PID so the stop script can target this exact instance (the agent
// runs headless via autostart, so there's no console to Ctrl+C).
const PID_FILE = path.join(DATA_DIR, "agent.pid");
function clearPid() { try { fs.unlinkSync(PID_FILE); } catch { /* already gone */ } }
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { clearPid(); process.exit(0); });
process.on("exit", clearPid);

server.listen(PORT, BIND, () => {
  try { fs.writeFileSync(PID_FILE, String(process.pid)); } catch { /* non-fatal */ }
  const url = `http://${lanAddress()}:${PORT}/#t=${token}`;
  console.log("\nLapDeck agent v" + VERSION);
  console.log("Scan this QR on your phone (same Wi-Fi):\n");
  qrcode.generate(url, { small: true });
  console.log("\nOr open:  " + url);
  console.log("Local test: http://localhost:" + PORT + "/#t=" + token);
  console.log("\nIf your phone can't connect, allow Node.js through Windows Firewall (private networks).\n");

  // Show the remote (from-anywhere) URL too, if Tailscale is up.
  getTailscaleIp().then((ip) => {
    if (!ip) return;
    const remote = `http://${ip}:${PORT}/#t=${token}`;
    console.log("Remote (Tailscale — works from anywhere on your tailnet):\n");
    qrcode.generate(remote, { small: true });
    console.log("\nOr open:  " + remote + "\n");
  });
});
