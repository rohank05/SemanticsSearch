import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { pool } from "../db.js";
import { generateTokens } from "../middleware/auth.js";

const router = Router();
const BCRYPT_ROUNDS = 12;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

router.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Email and password (≥8 chars) required" });
  }
  try {
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase().trim(), hash]
    );
    const { accessToken, refreshToken } = generateTokens(rows[0].id);
    await storeRefreshToken(rows[0].id, refreshToken);
    res.cookie("refresh_token", refreshToken, cookieOpts());
    res.status(201).json({ access_token: accessToken, user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "Email already registered" });
    throw err;
  }
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email.toLowerCase().trim()]);
  if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const { accessToken, refreshToken } = generateTokens(rows[0].id);
  await storeRefreshToken(rows[0].id, refreshToken);
  res.cookie("refresh_token", refreshToken, cookieOpts());
  res.json({ access_token: accessToken, user: { id: rows[0].id, email: rows[0].email } });
});

router.post("/refresh", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) return res.status(401).json({ error: "No refresh token" });
  try {
    const payload = jwt.verify(token, REFRESH_SECRET);
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const { rows } = await pool.query(
      "DELETE FROM refresh_tokens WHERE user_id = $1 AND token_hash = $2 AND expires_at > NOW() RETURNING user_id",
      [payload.sub, hash]
    );
    if (!rows.length) return res.status(401).json({ error: "Refresh token revoked or expired" });
    const { accessToken, refreshToken: newRefresh } = generateTokens(payload.sub);
    await storeRefreshToken(payload.sub, newRefresh);
    res.cookie("refresh_token", newRefresh, cookieOpts());
    res.json({ access_token: accessToken });
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

router.post("/logout", async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (token) {
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    await pool.query("DELETE FROM refresh_tokens WHERE token_hash = $1", [hash]);
  }
  res.clearCookie("refresh_token");
  res.json({ ok: true });
});

async function storeRefreshToken(userId, token) {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + INTERVAL '7 days')",
    [userId, hash]
  );
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

export default router;
