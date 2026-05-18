import { Router } from "express";
import { requireSession } from "../middleware/auth.js";
import { pool } from "../db.js";
import { vectorizeQuery } from "../services/vectorize.js";
import { summarizeResults, expandQuery } from "../services/synthesize.js";

const router = Router();

// POST /api/v1/search
router.post("/", requireSession, async (req, res) => {
  const { query, document_ids, top_k = 10 } = req.body;
  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({ error: "query is required" });
  }
  const k = Math.min(Number(top_k) || 10, 50);

  // Expand short queries using HyDE — fall back to raw query if Ollama unavailable
  const expandedQuery = await expandQuery(query.trim());
  const vectorInput = expandedQuery || query.trim();

  const vectorStart = Date.now();
  let queryVector;
  try {
    queryVector = await vectorizeQuery(vectorInput);
  } catch {
    return res.status(503).json({ error: "Vectorize service unavailable" });
  }
  const queryVectorMs = Date.now() - vectorStart;

  const vecLiteral = `[${queryVector.join(",")}]`;
  const ownerId = req.user?.sub ?? null;
  const guestId = req.guestSessionId ?? null;
  const docFilter = Array.isArray(document_ids) && document_ids.length > 0 ? document_ids : null;

  const MIN_SCORE = 0.25;

  const searchStart = Date.now();
  const { rows: rawRows } = await pool.query(
    `SELECT
       s.id              AS sentence_id,
       s.sentence_index,
       s.document_id,
       d.file_name       AS document_name,
       s.page_number,
       s.context_before,
       s.content,
       s.context_after,
       1 - (s.embedding <=> $1::vector) AS score
     FROM sentences s
     JOIN documents d ON d.id = s.document_id
     WHERE
       (d.owner_id = $2 OR d.guest_session_id = $3)
       AND ($4::uuid[] IS NULL OR d.id = ANY($4))
       AND d.status = 'ready'
     ORDER BY s.embedding <=> $1::vector
     LIMIT $5`,
    [vecLiteral, ownerId, guestId, docFilter, k * 3]
  );
  const rows = rawRows.filter((r) => Number(r.score) >= MIN_SCORE).slice(0, k);
  const searchMs = Date.now() - searchStart;

  res.json({
    results: rows,
    summary: null,            // summary is fetched separately via POST /summarize
    expanded_query: expandedQuery,
    query_vector_ms: queryVectorMs,
    search_ms: searchMs,
    synthesis_ms: null,
  });
});

// POST /v1/search/summarize — called async by the frontend after results are shown.
// Kept separate so the main search response is never blocked by phi3:mini.
router.post("/summarize", requireSession, async (req, res) => {
  const { query, results } = req.body;
  if (!query || !Array.isArray(results) || results.length === 0) {
    return res.json({ summary: null, synthesis_ms: null });
  }
  const start = Date.now();
  const summary = await summarizeResults(query, results);
  res.json({
    summary,
    synthesis_ms: summary != null ? Date.now() - start : null,
  });
});

export default router;
