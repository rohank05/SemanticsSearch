/**
 * Ingest public (preloaded) documents available to all users.
 *
 * Single file:
 *   node --env-file=.env scripts/ingest-public.js ./books/chemistry.pdf "Chemistry Grade 10"
 *
 * Whole folder (processes all PDF/DOCX/TXT files):
 *   node --env-file=.env scripts/ingest-public.js ./books/
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { basename, extname, join, resolve } from "path";
import { pool } from "../src/db.js";
import { ingestDocument } from "../src/services/ingestion.js";

const SUPPORTED_EXTS = new Set(["pdf", "docx", "txt"]);

function getMimeType(fp) {
  const ext = fp.split(".").pop()?.toLowerCase();
  if (ext === "pdf")  return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "text/plain";
}

async function ingestFile(filePath, displayName) {
  const ext      = extname(filePath);
  const fileName = displayName ? (displayName.includes(".") ? displayName : displayName + ext) : basename(filePath);
  const mimeType = getMimeType(filePath);
  const buffer   = readFileSync(filePath);

  const { rows } = await pool.query(
    `INSERT INTO documents (owner_id, guest_session_id, is_public, file_name, mime_type, expires_at)
     VALUES (NULL, NULL, true, $1, $2, '2099-01-01'::timestamptz)
     RETURNING id`,
    [fileName, mimeType]
  );

  const docId = rows[0].id;
  console.log(`  → ${fileName} (${docId})`);

  await ingestDocument(docId, buffer, mimeType);

  const { rows: [doc] } = await pool.query(
    "SELECT status, total_sentences FROM documents WHERE id = $1",
    [docId]
  );

  if (doc.status === "ready") {
    console.log(`  ✓ ${doc.total_sentences} chunks indexed`);
  } else {
    console.error(`  ✗ ended with status: ${doc.status}`);
  }
  return doc.status === "ready";
}

const [,, target, displayName] = process.argv;

if (!target) {
  console.error("Usage:");
  console.error("  node --env-file=.env scripts/ingest-public.js <file> [display-name]");
  console.error("  node --env-file=.env scripts/ingest-public.js <folder/>");
  process.exit(1);
}

const targetPath = resolve(target);
const stat = statSync(targetPath);

if (stat.isDirectory()) {
  const files = readdirSync(targetPath)
    .filter((f) => SUPPORTED_EXTS.has(f.split(".").pop()?.toLowerCase() ?? ""))
    .sort();

  if (files.length === 0) {
    console.error(`No PDF/DOCX/TXT files found in ${targetPath}`);
    process.exit(1);
  }

  console.log(`Found ${files.length} file(s) in ${targetPath}\n`);
  let ok = 0;
  for (const file of files) {
    console.log(`[${ok + 1}/${files.length}] ${file}`);
    const success = await ingestFile(join(targetPath, file));
    if (success) ok++;
    console.log();
  }
  console.log(`Done — ${ok}/${files.length} ingested successfully`);
} else {
  console.log(`Ingesting ${basename(targetPath)}…`);
  await ingestFile(targetPath, displayName);
}

await pool.end();
