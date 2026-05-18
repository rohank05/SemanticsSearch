import { readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { pool } from "../db.js";
import { ingestDocument } from "./ingestion.js";

export const UPLOAD_DIR = process.env.UPLOAD_DIR
  || join(import.meta.dirname, "../../uploads");

const POLL_MS = 5_000;
let busy = false;

async function processNext() {
  if (busy) return;

  // Atomically claim one pending document — SKIP LOCKED prevents double-processing
  const { rows } = await pool.query(`
    UPDATE documents SET status = 'processing'
    WHERE id = (
      SELECT id FROM documents
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING id, mime_type
  `);

  if (!rows.length) return;

  busy = true;
  const { id: docId, mime_type: mimeType } = rows[0];
  const filePath = join(UPLOAD_DIR, `${docId}.bin`);

  try {
    if (!existsSync(filePath)) throw new Error(`Upload file missing: ${filePath}`);
    const buffer = readFileSync(filePath);
    await ingestDocument(docId, buffer, mimeType);
  } catch (err) {
    console.error(`[worker] Failed to ingest ${docId}:`, err.message);
    await pool.query("UPDATE documents SET status = 'error' WHERE id = $1", [docId]);
  } finally {
    try { if (existsSync(filePath)) unlinkSync(filePath); } catch {}
    busy = false;
  }
}

export function startWorker() {
  console.log("[worker] Queue worker started — polling every", POLL_MS / 1000, "s");
  // Drain any docs that were pending before restart
  processNext().catch(console.error);
  setInterval(() => processNext().catch(console.error), POLL_MS);
}
