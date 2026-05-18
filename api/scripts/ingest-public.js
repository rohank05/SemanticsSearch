/**
 * Ingest a file as a public (preloaded) document available to all users.
 * Usage:
 *   node --env-file=.env scripts/ingest-public.js <file-path> [display-name]
 *
 * Examples:
 *   node --env-file=.env scripts/ingest-public.js ./books/chemistry-grade10.pdf
 *   node --env-file=.env scripts/ingest-public.js ./books/bio.pdf "Biology Grade 11"
 */
import { readFileSync } from "fs";
import { basename, extname } from "path";
import { pool } from "../src/db.js";
import { ingestDocument } from "../src/services/ingestion.js";

const [,, filePath, displayName] = process.argv;

if (!filePath) {
  console.error("Usage: node --env-file=.env scripts/ingest-public.js <file-path> [display-name]");
  process.exit(1);
}

function getMimeType(fp) {
  const ext = fp.split(".").pop()?.toLowerCase();
  if (ext === "pdf")  return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/plain";
}

const buffer   = readFileSync(filePath);
const ext      = extname(filePath);
const fileName = displayName ? (displayName.includes(".") ? displayName : displayName + ext) : basename(filePath);
const mimeType = getMimeType(filePath);

console.log(`Inserting public document: ${fileName}`);

const { rows } = await pool.query(
  `INSERT INTO documents (owner_id, guest_session_id, is_public, file_name, mime_type, expires_at)
   VALUES (NULL, NULL, true, $1, $2, '2099-01-01'::timestamptz)
   RETURNING id`,
  [fileName, mimeType]
);

const docId = rows[0].id;
console.log(`Document ID: ${docId}`);
console.log("Ingesting (this may take a while for large files)…");

await ingestDocument(docId, buffer, mimeType);

const { rows: [doc] } = await pool.query("SELECT status, total_sentences FROM documents WHERE id = $1", [docId]);
if (doc.status === "ready") {
  console.log(`✓ Done — ${doc.total_sentences} chunks indexed`);
} else {
  console.error(`✗ Ingestion ended with status: ${doc.status}`);
  process.exit(1);
}

await pool.end();
