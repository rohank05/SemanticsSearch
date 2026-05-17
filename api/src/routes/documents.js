import { Router } from "express";
import multer from "multer";
import { requireSession, optionalSession } from "../middleware/auth.js";
import { pool } from "../db.js";
import { ingestDocument } from "../services/ingestion.js";

const router = Router();

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const ALLOWED_EXT = new Set(["pdf", "docx", "txt"]);
const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const ext = file.originalname.split(".").pop()?.toLowerCase();
    if (ALLOWED_MIME.has(file.mimetype) || ALLOWED_EXT.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/v1/documents/upload
router.post("/upload", requireSession, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const expiresAt = req.user
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)  // 30 days for auth users
    : new Date(Date.now() + 10 * 60 * 1000);             // 10 min for guests

  const { rows } = await pool.query(
    `INSERT INTO documents (owner_id, guest_session_id, file_name, mime_type, expires_at)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      req.user?.sub ?? null,
      req.guestSessionId ?? null,
      file.originalname,
      file.mimetype,
      expiresAt,
    ]
  );

  const documentId = rows[0].id;

  // Kick off async ingestion — do not await
  ingestDocument(documentId, file.buffer, file.mimetype).catch(console.error);

  res.status(202).json({ document_id: documentId, status: "pending" });
});

// GET /api/v1/documents — works for auth users, guests, and unauthenticated visitors
router.get("/", optionalSession, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, file_name, mime_type, status, total_sentences, expires_at, created_at
     FROM documents
     WHERE (owner_id = $1 OR guest_session_id = $2)
     ORDER BY created_at DESC`,
    [req.user?.sub ?? null, req.guestSessionId ?? null]
  );
  res.json({ documents: rows });
});

// GET /api/v1/documents/:id
router.get("/:id", requireSession, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, file_name, mime_type, status, total_sentences, expires_at, created_at FROM documents WHERE id = $1 AND (owner_id = $2 OR guest_session_id = $3)",
    [req.params.id, req.user?.sub ?? null, req.guestSessionId ?? null]
  );
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  res.json(rows[0]);
});

// GET /api/v1/documents/:id/sentences
router.get("/:id/sentences", requireSession, async (req, res) => {
  const { rows: docRows } = await pool.query(
    "SELECT id, file_name, mime_type, total_sentences FROM documents WHERE id = $1 AND (owner_id = $2 OR guest_session_id = $3) AND status = 'ready'",
    [req.params.id, req.user?.sub ?? null, req.guestSessionId ?? null]
  );
  if (!docRows.length) return res.status(404).json({ error: "Not found" });

  const { rows } = await pool.query(
    "SELECT id, sentence_index, page_number, content, context_before, context_after FROM sentences WHERE document_id = $1 ORDER BY sentence_index ASC",
    [req.params.id]
  );
  res.json({ document: docRows[0], sentences: rows });
});

// DELETE /api/v1/documents/:id
router.delete("/:id", requireSession, async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM documents WHERE id = $1 AND (owner_id = $2 OR guest_session_id = $3)",
    [req.params.id, req.user?.sub ?? null, req.guestSessionId ?? null]
  );
  if (!rowCount) return res.status(404).json({ error: "Not found" });
  res.json({ ok: true });
});

export default router;
