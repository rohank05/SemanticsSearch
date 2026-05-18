import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import rateLimit from "express-rate-limit";
import authRouter from "./routes/auth.js";
import documentsRouter from "./routes/documents.js";
import searchRouter from "./routes/search.js";
import { startCleanupJob } from "./services/cleanup.js";
import { pool } from "./db.js";

const app = express();
const PORT = process.env.PORT || 4000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Guest-Session-Id"],
}));
app.use(express.json());
app.use(cookieParser());

// ── Rate limiting ───────────────────────────────────────────────────────────
app.use("/v1/search", rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));
app.use("/v1/documents/upload", rateLimit({ windowMs: 60_000, max: 50, standardHeaders: true, legacyHeaders: false }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use("/v1/auth", authRouter);
app.use("/v1/documents", documentsRouter);
app.use("/v1/search", searchRouter);

// ── Guest session creation ──────────────────────────────────────────────────
// Called by the frontend before a guest's first upload so we have a session ID.
app.post("/v1/guest/session", async (_req, res) => {
  const { rows } = await pool.query(
    "INSERT INTO guest_sessions (expires_at) VALUES (NOW() + INTERVAL '10 minutes') RETURNING id"
  );
  res.cookie("guest_session_id", rows[0].id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 10 * 60 * 1000,
  });
  res.json({ guest_session_id: rows[0].id });
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || "Internal server error" });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  startCleanupJob();
});
