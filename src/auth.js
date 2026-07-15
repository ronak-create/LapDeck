// Token auth guards for both HTTP routes and WebSocket sessions.
import crypto from "node:crypto";

let TOKEN = null;
export function setToken(token) {
  TOKEN = token;
}

// Constant-time compare; guards against length leaks by hashing to a fixed size.
export function tokenValid(candidate) {
  if (!TOKEN || typeof candidate !== "string") return false;
  const a = crypto.createHash("sha256").update(TOKEN).digest();
  const b = crypto.createHash("sha256").update(candidate).digest();
  return crypto.timingSafeEqual(a, b);
}

// Express middleware for non-static routes: require ?token= match.
export function httpAuth(req, res, next) {
  if (tokenValid(req.query.token)) return next();
  res.status(401).type("text/plain").send("unauthorized");
}
