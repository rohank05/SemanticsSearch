import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// Attaches req.user (auth) or req.guestSessionId (guest) — never both.
export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Accepts auth users OR guest sessions.
export async function requireSession(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try {
      req.user = jwt.verify(token, ACCESS_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }

  const guestId = req.headers["x-guest-session-id"] || req.cookies?.guest_session_id;
  if (guestId) {
    const { rows } = await pool.query(
      "SELECT id FROM guest_sessions WHERE id = $1 AND expires_at > NOW()",
      [guestId]
    );
    if (rows.length) {
      req.guestSessionId = guestId;
      // Refresh the 10-min rolling TTL on every API call
      await pool.query(
        "UPDATE guest_sessions SET last_active_at = NOW(), expires_at = NOW() + INTERVAL '10 minutes' WHERE id = $1",
        [guestId]
      );
      return next();
    }
  }

  res.status(401).json({ error: "No valid session" });
}

// Attaches req.user or req.guestSessionId if credentials are present, but never rejects.
export async function optionalSession(req, _res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    try { req.user = jwt.verify(token, ACCESS_SECRET); } catch { /* ignore */ }
  }
  if (!req.user) {
    const guestId = req.headers["x-guest-session-id"] || req.cookies?.guest_session_id;
    if (guestId) {
      const { rows } = await pool.query(
        "SELECT id FROM guest_sessions WHERE id = $1 AND expires_at > NOW()",
        [guestId]
      );
      if (rows.length) req.guestSessionId = guestId;
    }
  }
  next();
}

export function generateTokens(userId) {
  const accessToken = jwt.sign({ sub: userId }, ACCESS_SECRET, { expiresIn: "1h" });
  const refreshToken = jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
  return { accessToken, refreshToken };
}
