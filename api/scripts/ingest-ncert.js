/**
 * Downloads all NCERT textbooks chapter by chapter from ncert.nic.in,
 * merges each book's chapters into a single PDF, and uploads as public documents.
 *
 * Usage:
 *   node --env-file=.env scripts/ingest-ncert.js              # all books
 *   node --env-file=.env scripts/ingest-ncert.js --class 9    # one class
 *   node --env-file=.env scripts/ingest-ncert.js --code jesc1 # one book
 *   node --env-file=.env scripts/ingest-ncert.js --dry-run    # show catalog only
 *
 * Downloaded chapters are cached in ./ncert-cache/ so re-runs skip already
 * fetched files. Already-uploaded books are skipped automatically.
 */

import { PDFDocument } from "pdf-lib";
import fetch from "node-fetch";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { pool } from "../src/db.js";
import { ingestDocument } from "../src/services/ingestion.js";

const NCERT_BASE = "https://ncert.nic.in/textbook/pdf";
const CACHE_DIR  = join(import.meta.dirname, "../ncert-cache");
const DELAY_MS   = 800; // polite delay between chapter downloads

// ── Book catalog ─────────────────────────────────────────────────────────────
// Format: { code, name, class, maxChapters }
// maxChapters is a ceiling — the script stops automatically at the first 404.
const CATALOG = [
  // Class 6
  { code: "fesc1",  name: "Science",              class: 6,  maxChapters: 20 },
  { code: "femh1",  name: "Mathematics",          class: 6,  maxChapters: 20 },

  // Class 7
  { code: "gesc1",  name: "Science",              class: 7,  maxChapters: 20 },
  { code: "gemh1",  name: "Mathematics",          class: 7,  maxChapters: 20 },

  // Class 8
  { code: "hesc1",  name: "Science",              class: 8,  maxChapters: 20 },
  { code: "hemh1",  name: "Mathematics",          class: 8,  maxChapters: 20 },

  // Class 9
  { code: "jesc1",  name: "Science",              class: 9,  maxChapters: 20 },
  { code: "jemh1",  name: "Mathematics",          class: 9,  maxChapters: 20 },
  { code: "jeh1",   name: "History (India & World)", class: 9, maxChapters: 10 },
  { code: "jecg1",  name: "Geography",            class: 9,  maxChapters: 10 },
  { code: "jeep1",  name: "Political Science",    class: 9,  maxChapters: 10 },
  { code: "jeee1",  name: "Economics",            class: 9,  maxChapters: 10 },

  // Class 10
  { code: "jesc2",  name: "Science",              class: 10, maxChapters: 20 },
  { code: "jemh2",  name: "Mathematics",          class: 10, maxChapters: 20 },
  { code: "jeh2",   name: "History",              class: 10, maxChapters: 10 },
  { code: "jecg2",  name: "Geography",            class: 10, maxChapters: 10 },
  { code: "jeep2",  name: "Political Science",    class: 10, maxChapters: 10 },
  { code: "jeee2",  name: "Economics",            class: 10, maxChapters: 10 },

  // Class 11
  { code: "leph1",  name: "Physics Part 1",       class: 11, maxChapters: 10 },
  { code: "leph2",  name: "Physics Part 2",       class: 11, maxChapters: 10 },
  { code: "lech1",  name: "Chemistry Part 1",     class: 11, maxChapters: 10 },
  { code: "lech2",  name: "Chemistry Part 2",     class: 11, maxChapters: 10 },
  { code: "lebo1",  name: "Biology",              class: 11, maxChapters: 25 },
  { code: "lemh1",  name: "Mathematics Part 1",   class: 11, maxChapters: 10 },
  { code: "lemh2",  name: "Mathematics Part 2",   class: 11, maxChapters: 10 },

  // Class 12
  { code: "leph3",  name: "Physics Part 1",       class: 12, maxChapters: 10 },
  { code: "leph4",  name: "Physics Part 2",       class: 12, maxChapters: 10 },
  { code: "lech3",  name: "Chemistry Part 1",     class: 12, maxChapters: 10 },
  { code: "lech4",  name: "Chemistry Part 2",     class: 12, maxChapters: 10 },
  { code: "lebo2",  name: "Biology",              class: 12, maxChapters: 25 },
  { code: "lemh3",  name: "Mathematics Part 1",   class: 12, maxChapters: 10 },
  { code: "lemh4",  name: "Mathematics Part 2",   class: 12, maxChapters: 10 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function bookFileName({ code, name, class: cls }) {
  return `NCERT Class ${cls} – ${name}.pdf`;
}

async function downloadChapter(code, n) {
  const num    = String(n).padStart(2, "0");
  const cached = join(CACHE_DIR, code, `${num}.pdf`);

  if (existsSync(cached)) {
    return readFileSync(cached);
  }

  const url = `${NCERT_BASE}/${code}${num}.pdf`;
  const res  = await fetch(url, { timeout: 30_000 });
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(join(CACHE_DIR, code), { recursive: true });
  writeFileSync(cached, buf);
  return buf;
}

async function mergeBuffers(buffers) {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    try {
      const src   = await PDFDocument.load(buf, { ignoreEncryption: true });
      const pages = await merged.copyPages(src, src.getPageIndices());
      pages.forEach((p) => merged.addPage(p));
    } catch {
      // Skip a corrupt chapter rather than aborting the whole book
    }
  }
  return Buffer.from(await merged.save());
}

async function alreadyUploaded(fileName) {
  const { rows } = await pool.query(
    "SELECT id FROM documents WHERE is_public = true AND file_name = $1 LIMIT 1",
    [fileName]
  );
  return rows.length > 0;
}

async function ingestBook(book) {
  const fileName = bookFileName(book);

  if (await alreadyUploaded(fileName)) {
    console.log(`  ⏭  Already uploaded — skipping`);
    return;
  }

  // Download chapters until 404
  const chapters = [];
  for (let n = 1; n <= book.maxChapters; n++) {
    process.stdout.write(`  ↓ Chapter ${n}…`);
    const buf = await downloadChapter(book.code, n);
    if (!buf) { process.stdout.write(` (end)\n`); break; }
    chapters.push(buf);
    process.stdout.write(` ${(buf.length / 1024).toFixed(0)} KB\n`);
    await sleep(DELAY_MS);
  }

  if (chapters.length === 0) {
    console.log(`  ✗ No chapters found — book code may be wrong`);
    return;
  }

  // Merge
  process.stdout.write(`  ⚙  Merging ${chapters.length} chapters…`);
  const merged = await mergeBuffers(chapters);
  process.stdout.write(` ${(merged.length / 1024 / 1024).toFixed(1)} MB\n`);

  // Upload
  const { rows } = await pool.query(
    `INSERT INTO documents (owner_id, guest_session_id, is_public, file_name, mime_type, expires_at)
     VALUES (NULL, NULL, true, $1, 'application/pdf', '2099-01-01'::timestamptz)
     RETURNING id`,
    [fileName]
  );
  const docId = rows[0].id;

  console.log(`  ⬆  Ingesting (${docId})…`);
  await ingestDocument(docId, merged, "application/pdf");

  const { rows: [doc] } = await pool.query(
    "SELECT status, total_sentences FROM documents WHERE id = $1",
    [docId]
  );

  if (doc.status === "ready") {
    console.log(`  ✓ Done — ${doc.total_sentences} chunks indexed`);
  } else {
    console.error(`  ✗ Ended with status: ${doc.status}`);
  }
}

// ── CLI arg parsing ───────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const isDry  = args.includes("--dry-run");
const clsArg = args.includes("--class") ? Number(args[args.indexOf("--class") + 1]) : null;
const codeArg = args.includes("--code") ? args[args.indexOf("--code") + 1] : null;

let books = CATALOG;
if (clsArg)  books = books.filter((b) => b.class === clsArg);
if (codeArg) books = books.filter((b) => b.code === codeArg);

if (books.length === 0) {
  console.error("No matching books found in catalog.");
  process.exit(1);
}

console.log(`NCERT ingestion — ${books.length} book(s) queued\n`);

if (isDry) {
  books.forEach((b) => console.log(`  ${b.code}  →  ${bookFileName(b)}`));
  process.exit(0);
}

mkdirSync(CACHE_DIR, { recursive: true });

let ok = 0;
for (const [i, book] of books.entries()) {
  const label = bookFileName(book);
  console.log(`[${i + 1}/${books.length}] ${label}`);
  try {
    await ingestBook(book);
    ok++;
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
  }
  console.log();
}

console.log(`─────────────────────────────────────`);
console.log(`Done — ${ok}/${books.length} books uploaded`);
console.log(`Chapter cache saved to: ${CACHE_DIR}`);

await pool.end();
