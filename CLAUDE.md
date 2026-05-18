# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository structure

Two independent Node.js projects, no shared monorepo tooling:

```
document-searcher/
  api/    — Express API (ESM, Node 20+)
  web/    — Next.js 16 frontend (App Router, TypeScript)
```

## Development commands

### API (`api/`)
```bash
npm run dev       # node --watch src/index.js with .env loaded
npm run migrate   # run all SQL migrations in order
```
The API loads env via `--env-file=.env` (Node built-in); no `dotenv` package.

### Web (`web/`)
```bash
npm run dev       # Next.js dev server on :3000
npm run build     # production build
```

### External services required
- **PostgreSQL** — `DATABASE_URL` in `api/.env`
- **Ollama** (native, not Docker) — must be running on `localhost:11434`
  - `nomic-embed-text` — document and query embeddings (768-dim)
- **Google Gemini API** — `GEMINI_API_KEY` in `api/.env`
  - `gemini-2.0-flash-lite` — query expansion (HyDE) + summarization
  - Both degrade gracefully to `null` if `GEMINI_API_KEY` is absent

Docker Compose only manages Ollama. PostgreSQL is run directly.

### Admin: ingest public textbooks
```bash
cd api
node --env-file=.env scripts/ingest-public.js ./books/chemistry.pdf "Chemistry Grade 10"
```
Public documents have `is_public = true`, no owner, and expire in 2099. They are visible to all users including unauthenticated guests.

## Architecture

### Ingestion pipeline
Upload → `documents` row created → `ingestDocument()` fires async (does not block the upload response):
1. Extract text per-page (`pdf-parse` for PDF, `mammoth` for DOCX, raw UTF-8 for TXT)
2. Sentence-split with `sbd`
3. Build **overlapping chunks**: 4 sentences per chunk, stride 2 — so every chunk embeds multi-sentence context, improving recall for concept-level queries
4. Vectorize all chunk texts via Ollama `/api/embed` (batch, 16 at a time) using `nomic-embed-text`
5. Bulk-insert into `sentences` table with `embedding vector(768)`
6. Set `documents.status = 'ready'`

The `sentences` table stores chunks, not individual sentences. `content` is the joined 4-sentence window; `context_before`/`context_after` are the adjacent chunks.

### Search pipeline
`POST /api/v1/search`:
1. If query is ≤10 words: **HyDE expansion** via `phi3:mini` — rewrites the query as a hypothetical document passage before vectorizing (dramatically improves cosine similarity)
2. Vectorize the (possibly expanded) query via `nomic-embed-text`
3. pgvector IVFFlat cosine search, fetch `top_k * 3` candidates
4. Filter out results with cosine similarity < 0.25 (prevents returning irrelevant noise), slice to `top_k`
5. Async summarization via `phi3:mini` (never blocks search response; both Ollama calls degrade gracefully to `null` if unavailable)

### Auth model
Two session types, never mixed:
- **Auth users**: JWT access token (1h, `Authorization: Bearer`) + httpOnly refresh token cookie (7d, rotated)
- **Guests**: UUID stored in `localStorage` as `guest_session_id`, sent as `X-Guest-Session-Id` header (cookie-based guest auth was dropped due to cross-port `SameSite=Strict` blocking)

`requireSession` middleware accepts either. `optionalSession` attaches whichever is present without rejecting.

Access tokens are stored in `localStorage` (`access_token` key) by `web/lib/api.ts` after login/register and included as `Authorization: Bearer` on all subsequent API calls.

### Frontend data flow
Single page at `/search` (`web/app/search/page.tsx`) owns all state. Key flows:
- **Upload**: snapshot `FileList` with `Array.from()` before any `await` (FileList is a live DOM reference cleared by `e.target.value = ""`), then parallel per-file uploads each with independent progress tracking in `ingestingDocs[]`
- **Search**: 600ms debounce (accounts for Ollama latency); debounce resets on `query` or `docFilter` change
- **Guest session**: created lazily before first upload via `ensureGuestSession()`, guarded by a ref to prevent double-creation
- **Document viewer** (`/documents/[id]?s=<sentence_id>`): fetches all chunks for a document and scrolls to the target chunk

Types flow: `ApiSearchResult` (API shape) → `toSearchResult()` → `SearchResult` (component shape defined in `web/lib/corpus.ts`).

### Database schema highlights
- `documents.owner_id` XOR `guest_session_id` (CHECK constraint enforces exactly one)
- `sentences.embedding vector(768)` — IVFFlat index with `lists = 100`
- Cleanup cron runs every 5 minutes: deletes expired documents (CASCADE removes sentences), expired guest sessions, and expired refresh tokens

## Key constraints

**Schema migrations are destructive**: `002_upgrade_vectors.sql` clears all documents and sentences. After any migration that changes the embedding dimension, all documents must be re-uploaded — the original file buffers are not persisted, only the extracted chunks.

**Ollama must be running natively** (not via Docker Desktop) because Docker Desktop's memory limits (typically 4–5 GB) are insufficient for even quantized models alongside Postgres. Use `brew install ollama` + `ollama serve`.

**IVFFlat index requires data to be useful**: the index is created empty after migration. It becomes effective once a meaningful number of rows exist. For small datasets, exact cosine search (no index) is used automatically by pgvector.

**The `nomic-embed-text` prefix**: nomic-embed-text performs best when queries are prefixed with `search_query:` and documents with `search_document:`. This is not currently applied — adding these prefixes to `vectorizeQuery()` and chunk text in ingestion is a pending improvement.

## nginx / production routing

All API routes are under `/v1/` (no `/api` prefix). nginx routes `/v1/` to Express on port 4000 and everything else to Next.js on port 3004. Set `NEXT_PUBLIC_API_URL=` (empty) in `web/.env.local` for production so API calls are relative to the same origin and routed through nginx. Use `NEXT_PUBLIC_API_URL=http://localhost:4000` for local development without nginx.

## Environment variables (`api/.env`)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Signs 1h access tokens |
| `JWT_REFRESH_SECRET` | Signs 7d refresh tokens |
| `GEMINI_API_KEY` | Google Gemini API key for HyDE + summarization |
| `OLLAMA_URL` | Ollama base URL (default `http://localhost:11434`) |
| `OLLAMA_EMBED_MODEL` | Embedding model (default `nomic-embed-text`) |
| `FRONTEND_URL` | CORS origin |
| `PORT` | API port (default `4000`) |
