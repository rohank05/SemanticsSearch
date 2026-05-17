import { createRequire } from "module";
import { vectorizeSentences } from "./vectorize.js";
import { pool } from "../db.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const sbd = require("sbd");

// Extract text from uploaded buffer, returning [{text, pageNumber?}] per page.
async function extractText(buffer, mimeType) {
  if (mimeType === "application/pdf" || mimeType === "pdf") {
    const data = await pdfParse(buffer);
    // pdf-parse gives per-page text in data.text, but not per-page array by default.
    // We use the render_page callback to get page-level text.
    const pages = [];
    await pdfParse(buffer, {
      pagerender(pageData) {
        return pageData.getTextContent().then((tc) => {
          const text = tc.items.map((i) => i.str).join(" ");
          pages.push(text);
          return text;
        });
      },
    });
    if (pages.length === 0) {
      // Fallback: treat whole doc as page 1
      pages.push(data.text);
    }
    return pages.map((text, i) => ({ text, pageNumber: i + 1 }));
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return [{ text: result.value, pageNumber: null }];
  }

  // Plain text
  return [{ text: buffer.toString("utf8"), pageNumber: null }];
}

// Split text into sentences with position tracking.
function splitIntoSentences(pages) {
  const sentences = [];
  let globalIdx = 0;
  for (const { text, pageNumber } of pages) {
    const pageSents = sbd.sentences(text, { newline_boundaries: true });
    for (const s of pageSents) {
      const trimmed = s.trim();
      if (trimmed.split(/\s+/).length < 3) continue; // skip headings / single words
      sentences.push({ text: trimmed, pageNumber, sentenceIndex: globalIdx++ });
    }
  }
  return sentences;
}

// Build overlapping chunks: each chunk spans CHUNK_SIZE sentences, stepping STRIDE at a time.
// This embeds multi-sentence context together, dramatically improving recall for concept-level queries.
const CHUNK_SIZE = 4;
const STRIDE = 2;

function buildChunks(sentences) {
  if (sentences.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < sentences.length; i += STRIDE) {
    const slice = sentences.slice(i, i + CHUNK_SIZE);
    chunks.push({
      text: slice.map((s) => s.text).join(" "),
      pageNumber: slice[0].pageNumber,
      sentenceIndex: slice[0].sentenceIndex,
    });
  }
  return chunks;
}

// Main ingestion pipeline — runs asynchronously after upload returns.
export async function ingestDocument(documentId, buffer, mimeType) {
  try {
    await pool.query("UPDATE documents SET status = 'processing' WHERE id = $1", [documentId]);

    const pages = await extractText(buffer, mimeType);
    const rawSentences = splitIntoSentences(pages);

    if (rawSentences.length === 0) {
      await pool.query(
        "UPDATE documents SET status = 'error', total_sentences = 0 WHERE id = $1",
        [documentId]
      );
      return;
    }

    const chunks = buildChunks(rawSentences);

    // Vectorize all chunks
    const texts = chunks.map((c) => c.text);
    const vectors = await vectorizeSentences(texts);

    // Verify no null embeddings before inserting
    for (let i = 0; i < vectors.length; i++) {
      if (!vectors[i] || vectors[i].length === 0) {
        throw new Error(`Null embedding returned for chunk index ${i}`);
      }
    }

    // Bulk insert in a single transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const contextBefore = i > 0 ? chunks[i - 1].text : null;
        const contextAfter = i < chunks.length - 1 ? chunks[i + 1].text : null;
        const vec = `[${vectors[i].join(",")}]`;

        await client.query(
          `INSERT INTO sentences
             (document_id, sentence_index, page_number, content, context_before, context_after, embedding)
           VALUES ($1, $2, $3, $4, $5, $6, $7::vector)`,
          [documentId, c.sentenceIndex, c.pageNumber, c.text, contextBefore, contextAfter, vec]
        );
      }
      await client.query(
        "UPDATE documents SET status = 'ready', total_sentences = $1 WHERE id = $2",
        [chunks.length, documentId]
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(`Ingestion failed for document ${documentId}:`, err);
    await pool.query(
      "UPDATE documents SET status = 'error' WHERE id = $1",
      [documentId]
    );
  }
}
