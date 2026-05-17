# SemanticSearch — Product Requirements Document

| Field | Value |
|---|---|
| **Version** | v1.1 |
| **Status** | Draft |
| **Author** | Rohan Kumar |
| **Date** | May 2026 |
| **Stack** | Node.js · Express · Next.js · PostgreSQL + pgvector |
| **Changelog** | v1.1 — Revised ingestion from token-window chunking to sentence-level vectorization to match the `/vectorize` API contract and enable precise result location |

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Goals & Non-Goals](#2-goals--non-goals)
3. [User Stories & Acceptance Criteria](#3-user-stories--acceptance-criteria)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [System Architecture](#6-system-architecture)
7. [Database Schema](#7-database-schema)
8. [API Design](#8-api-design)
9. [Vectorize API Integration](#9-vectorize-api-integration)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Security Considerations](#11-security-considerations)
12. [Milestones & Delivery Roadmap](#12-milestones--delivery-roadmap)
13. [Open Questions](#13-open-questions)
14. [Appendix](#14-appendix)

---

## 1. Product Overview

SemanticSearch is a web application that lets users upload documents and search through them using natural-language queries — the way they'd search Google — powered by vector embeddings. Unlike keyword search, the engine understands meaning and context, surfacing the exact sentences that are relevant even when the user's phrasing doesn't match the document verbatim.

### 1.1 Problem Statement

Users accumulate large numbers of documents (contracts, notes, research papers) and have no efficient way to retrieve specific information across them. Keyword search fails when the user phrases the query differently from how the document was written. Even when a result is found, the user still has to hunt through the document to find where to read.

### 1.2 Proposed Solution

A lightweight, self-serve SaaS requiring no ML expertise. The user uploads a document; the platform:

1. Extracts full text and splits it into individual **sentences**
2. Vectorizes each sentence via the `/vectorize` API
3. Stores each sentence with its embedding, position, page number (where available), and surrounding context
4. At query time, vectorizes the query and finds the top-K most semantically similar sentences
5. Returns results as Google-style snippets — the matching sentence highlighted, with 1–2 sentences of context on each side — plus the document name and page reference so the user knows **exactly where to read**

Authenticated users retain data for 30 days; guests get a one-time session with 10-minute auto-delete.

### 1.3 Target Users

| Persona | Job-to-be-Done | File Types | Auth Preference |
|---|---|---|---|
| Student / Researcher | Search across lecture notes & papers | PDF, DOCX | Sign-up |
| Knowledge Worker | Query contracts & internal docs | PDF, DOCX, TXT | Sign-up |
| Casual Visitor | Quick one-off doc search | Any supported | Guest |
| Developer / Tester | Evaluate search quality | TXT, PDF | Sign-up |

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Enable natural-language search over user-uploaded documents with sub-2s query latency (P95)
- Support `.pdf`, `.docx`, and `.txt` uploads up to 10 MB per file
- Store and retrieve data at **sentence granularity** so results point the user to the exact line to read
- Surface results as contextual snippets (preceding sentence + **match** + following sentence) with document name and page number
- Implement zero-friction guest mode — no sign-up required — with automatic TTL cleanup after 10 minutes of inactivity
- Authenticated users get 30-day data retention; automated cleanup keeps the database lean
- Provide a clean, Google-like search UX in Next.js with instant result highlighting

### 2.2 Non-Goals (v1)

- Real-time collaborative editing of documents
- Hosting or training a custom embedding model (the external `/vectorize` API is the dependency)
- Mobile-native apps (responsive web is sufficient)
- Full-text OCR for scanned / image-only PDFs
- Multi-language support beyond English
- Semantic re-ranking (BM25 hybrid search)

---

## 3. User Stories & Acceptance Criteria

### 3.1 Authentication & Session

| ID | As a… | I want to… | Acceptance Criteria |
|---|---|---|---|
| US-01 | New visitor | Sign up with email & password | Account created; JWT pair returned; password stored as bcrypt hash |
| US-02 | Returning user | Log in and see my documents | Access token issued; document library loads |
| US-03 | Guest | Upload a doc and search without an account | Guest UUID issued; upload and search work |
| US-04 | Guest | Be warned my session expires in 10 min | Banner visible with countdown; refreshed on each API call |
| US-05 | System (cron) | Have expired data auto-deleted | Rows where `expires_at < NOW()` deleted every 5 min |

### 3.2 Document Upload & Ingestion

| ID | As a… | I want to… | Acceptance Criteria |
|---|---|---|---|
| US-06 | Any user | Upload a .pdf, .docx, or .txt file ≤ 10 MB | File accepted; ingestion pipeline starts |
| US-07 | Any user | See a progress indicator during processing | Status field cycles `pending → processing → ready` |
| US-08 | Any user | Get a clear error on unsupported file or size | 400 response with descriptive message |
| US-09 | System | Split document into individual sentences | Sentence splitter produces one row per sentence |
| US-10 | System | Vectorize each sentence via `/vectorize` API | Each sentence row has a non-null `embedding` vector |
| US-11 | System | Store page number per sentence where available | `page_number` populated for PDFs; NULL for DOCX/TXT |
| US-12 | Auth user | See my document library with expiry dates | Dashboard lists all docs with `expires_at` visible |

### 3.3 Search

| ID | As a… | I want to… | Acceptance Criteria |
|---|---|---|---|
| US-13 | Any user | Type a natural-language query and get relevant results | Top-K sentences returned ranked by cosine similarity |
| US-14 | Any user | See a snippet with context around each result | `context_before` + **match** + `context_after` displayed |
| US-15 | Any user | See which document and page each result came from | `document_name` and `page_number` (if available) shown |
| US-16 | Auth user | Filter results by a specific document | `document_ids` filter param narrows the search |
| US-17 | Any user | Search across all my uploaded docs at once | Single query spans all user-owned sentences |

### 3.4 Data Lifecycle

| ID | As a… | I want to… | Acceptance Criteria |
|---|---|---|---|
| US-18 | Auth user | Have docs auto-deleted after 30 days | Cron deletes rows where `expires_at < NOW()` |
| US-19 | Guest | Have session data deleted after 10 min of inactivity | Guest rows purged 10 min after `last_active_at` |
| US-20 | Any user | Manually delete a document | Hard delete removes doc + all its sentence rows immediately |
| US-21 | Auth user | See expiry date on each document card | `expires_at` displayed; warning state at < 3 days |

---

## 4. Functional Requirements

### 4.1 Authentication Module

- Email + password sign-up with bcrypt hashing (rounds ≥ 12)
- JWT-based session: access token 1 h, refresh token 7 d stored in `httpOnly` cookie
- Guest sessions: server-issued UUID on first document upload, persisted in a cookie
- `last_active_at` on `guest_sessions` updated on every API call; TTL reset accordingly
- Password reset via time-limited email token (24 h TTL)

### 4.2 Document Ingestion Pipeline

The ingestion pipeline runs asynchronously after upload and follows this exact sequence:

```
1. Validate file (MIME type, size ≤ 10 MB, extension whitelist)
2. Extract raw text:
     - PDF  → pdf-parse  (provides text per page → preserves page_number)
     - DOCX → mammoth    (full text only → page_number = NULL)
     - TXT  → fs.readFile (full text only → page_number = NULL)
3. Split text into sentences:
     - Use `compromise` NLP or `sbd` (sentence boundary detection)
     - Output: [{ text, sentenceIndex, pageNumber? }, ...]
4. Batch sentences into groups of 32
5. POST each batch to https://vector.therohankumar.com/vectorize
     - Body: { "sentences": ["sent1", "sent2", ...] }
     - Map returned vectors back to sentences by array index
6. For each sentence, store:
     - content (the sentence)
     - embedding (the vector)
     - sentence_index (global position in doc)
     - page_number (from PDF extraction, else NULL)
     - context_before (sentence at index - 1, or NULL)
     - context_after  (sentence at index + 1, or NULL)
7. Update documents.status → 'ready', documents.total_sentences = count
```

> **Why sentence-level, not chunk-level?**
> The `/vectorize` API is designed for sentences. Sending 500-token blobs produces a single averaged vector that loses granularity. Sentence-level storage means every result can point the user to exactly one line in the document — combined with `context_before`/`context_after`, this gives Google-style snippets with precise location metadata.

### 4.3 Search & Retrieval

1. Receive `query` string from user
2. POST `{ "sentences": [query] }` to `/vectorize`; extract `vectors[0]`
3. Run pgvector cosine similarity query against all sentences owned by the user (see Appendix B)
4. Return top-K results (default 10, max 50) each containing:
   - `sentence_id`, `document_id`, `document_name`
   - `page_number` (nullable)
   - `context_before`, `content` (the match), `context_after`
   - `score` (cosine similarity, 0–1)
5. Response time target: < 2 s end-to-end for collections up to 10,000 sentences

### 4.4 Data Lifecycle & Cleanup

A `node-cron` job runs every **5 minutes**:

```
DELETE FROM documents  WHERE expires_at < NOW();
-- sentences cascade via FK ON DELETE CASCADE
DELETE FROM guest_sessions WHERE expires_at < NOW();
```

| Event | TTL |
|---|---|
| Guest — last API activity | 10 min rolling |
| Guest — document (no activity) | 10 min from upload |
| Auth user — document | 30 days from upload |
| Cron frequency | Every 5 min |
| Manual delete | Immediate hard delete |

---

## 5. Non-Functional Requirements

| Category | Requirement | Target | Notes |
|---|---|---|---|
| Performance | Search latency P95 | < 2 s | Up to 10K sentences per user |
| Performance | Ingestion time | < 45 s / 10 MB file | Async; user sees progress |
| Scalability | Concurrent users | 50 simultaneous | v1 single-node |
| Availability | Uptime | 99.5% | Excludes planned maintenance |
| Security | Data isolation | Row-level `owner_id` / `guest_session_id` filter on all queries | No naked sentence selects |
| Security | Auth tokens | JWT + `httpOnly` cookie | No `localStorage` tokens |
| Storage | DB size control | TTL-based auto-cleanup | Target < 20 GB |
| Compliance | File storage | Temp only during ingestion | Raw files not persisted post-ingest |

---

## 6. System Architecture

### 6.1 High-Level Components

```
┌─────────────────────┐        ┌──────────────────────────┐
│   Next.js 15        │◄──────►│   Express 5 API Server   │
│   (App Router)      │  REST  │                          │
└─────────────────────┘        │  ┌────────────────────┐  │
                                │  │  Ingestion Service │  │
                                │  │  sentence split    │  │
                                │  │  batch vectorize   │  │
                                │  │  bulk insert       │  │
                                │  └────────┬───────────┘  │
                                │           │              │
                                │  ┌────────▼───────────┐  │
                                │  │   Search Service   │  │
                                │  │   vectorize query  │  │
                                │  │   pgvector ANN     │  │
                                │  └────────────────────┘  │
                                │                          │
                                │  ┌────────────────────┐  │
                                │  │  Cron Cleanup Job  │  │
                                │  │  (node-cron, 5min) │  │
                                │  └────────────────────┘  │
                                └──────────┬───────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │   PostgreSQL 16 + pgvector          │
                         │   users / guest_sessions /          │
                         │   documents / sentences             │
                         └─────────────────────────────────────┘
                                           │
                         ┌─────────────────▼──────────────────┐
                         │  vector.therohankumar.com/vectorize │
                         │  (external — sentence → float[])    │
                         └─────────────────────────────────────┘
```

### 6.2 Technology Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend | Next.js (App Router) | 15 | UI, routing, SSR |
| Frontend | Tailwind CSS | v4 | Styling |
| Frontend | TanStack Query | v5 | Server state & caching |
| Backend | Node.js | 22 LTS | Runtime |
| Backend | Express | 5 | REST API framework |
| Backend | multer | 2 | Multipart file upload |
| Backend | pdf-parse | 1 | PDF text + page extraction |
| Backend | mammoth | 1 | DOCX text extraction |
| Backend | compromise / sbd | latest | Sentence boundary detection |
| Backend | node-cron | 3 | Scheduled cleanup jobs |
| Backend | jsonwebtoken | 9 | JWT auth |
| Backend | bcrypt | 5 | Password hashing |
| Database | PostgreSQL | 16 | Primary store |
| Database | pgvector | 0.8 | Vector similarity search |
| Database | node-postgres (pg) | 8 | DB driver |
| DevOps | Docker Compose | — | Local + prod deployment |

---

## 7. Database Schema

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 7.1 `users`

```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 `guest_sessions`

```sql
CREATE TABLE guest_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL, -- NOW() + INTERVAL '10 minutes'
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 `documents`

```sql
CREATE TABLE documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_session_id UUID REFERENCES guest_sessions(id) ON DELETE CASCADE,
  file_name        TEXT NOT NULL,
  mime_type        TEXT NOT NULL,
  total_sentences  INT NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'pending',
    -- pending | processing | ready | error
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT owner_xor_guest CHECK (
    (owner_id IS NOT NULL)::int + (guest_session_id IS NOT NULL)::int = 1
  )
);
```

### 7.4 `sentences`

```sql
CREATE TABLE sentences (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sentence_index INT NOT NULL,       -- global 0-based position in doc
  page_number    INT,                -- populated for PDFs; NULL for DOCX/TXT
  content        TEXT NOT NULL,      -- the sentence itself
  context_before TEXT,               -- sentence at index - 1 (for snippet display)
  context_after  TEXT,               -- sentence at index + 1 (for snippet display)
  embedding      vector(768),        -- ⚠ verify dimension against your vectorize API
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ANN index for cosine similarity search
CREATE INDEX sentences_embedding_idx
  ON sentences
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Fast lookup by document
CREATE INDEX sentences_document_idx ON sentences (document_id);
```

> **Dimension note:** `768` is assumed from the sample response. Confirm with `vectors[0].length` before running migrations. If the API returns a different dimension, update the `vector(N)` declaration accordingly.

---

## 8. API Design

**Base path:** `/api/v1`
**All responses:** `Content-Type: application/json`

### 8.1 Authentication

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Register with email + password; returns JWT pair |
| `POST` | `/auth/login` | None | Login; sets `httpOnly` refresh cookie, returns access token |
| `POST` | `/auth/refresh` | Cookie | Rotate refresh token; return new access token |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token; clear cookie |
| `POST` | `/auth/forgot-password` | None | Send password reset email |
| `POST` | `/auth/reset-password` | Token param | Consume reset token; update password |

### 8.2 Documents

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/documents/upload` | Bearer / Guest | Multipart upload; starts async ingestion pipeline |
| `GET` | `/documents` | Bearer | List user's documents with status and expiry |
| `GET` | `/documents/:id` | Bearer / Guest | Get single document metadata |
| `DELETE` | `/documents/:id` | Bearer / Guest | Hard delete document and all its sentences |

### 8.3 Search

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/search` | Bearer / Guest | Execute semantic search across user's documents |

**Request body:**

```json
{
  "query": "what are the refund terms?",
  "document_ids": ["uuid-1", "uuid-2"],
  "top_k": 10
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `query` | string | ✅ | — |
| `document_ids` | string[] | ❌ | all user docs |
| `top_k` | int | ❌ | 10 (max 50) |

**Response:**

```json
{
  "results": [
    {
      "sentence_id": "uuid",
      "document_id": "uuid",
      "document_name": "contract_v2.pdf",
      "page_number": 4,
      "context_before": "All sales are subject to the following terms.",
      "content": "Refunds must be requested within 14 days of purchase.",
      "context_after": "After 14 days, store credit may be issued at our discretion.",
      "score": 0.91
    }
  ],
  "query_vector_ms": 45,
  "search_ms": 120
}
```

---

## 9. Vectorize API Integration

**Endpoint:** `POST https://vector.therohankumar.com/vectorize`

```bash
curl --location 'https://vector.therohankumar.com/vectorize' \
  --header 'Content-Type: application/json' \
  --data '{ "sentences": ["Hello"] }'
```

| Property | Value |
|---|---|
| Request body | `{ "sentences": string[] }` |
| Response | `{ "vectors": float[][] }` |
| Dimension | 768 (assumed — verify before schema creation) |
| Max batch size | 32 sentences per request |
| Used at | Ingestion (per sentence) + Query time |

### 9.1 Ingestion Flow

```
Raw text
  │
  ▼
Sentence splitter (compromise / sbd)
  │   produces: [{ text, index, pageNumber? }, ...]
  ▼
Batch into groups of 32
  │
  ▼
POST /vectorize  ← { "sentences": ["s1", "s2", ...] }
  │               → { "vectors": [[...], [...], ...] }
  ▼
Zip sentences ↔ vectors by array index
  │
  ▼
Bulk INSERT into sentences table
  (content, embedding, sentence_index, page_number,
   context_before, context_after, document_id)
  │
  ▼
UPDATE documents SET status = 'ready', total_sentences = N
```

### 9.2 Query Flow

```
User query string
  │
  ▼
POST /vectorize  ← { "sentences": ["query string"] }
  │               → { "vectors": [[...]] }
  ▼
pgvector cosine similarity search (see Appendix B)
  │
  ▼
Return top-K sentences with context + location metadata
```

### 9.3 Error Handling

| Scenario | Behaviour |
|---|---|
| `/vectorize` unreachable at startup | Log warning; do not crash — allow reads |
| `/vectorize` fails during ingestion | Mark `documents.status = 'error'`; surface message to user |
| `/vectorize` fails during search | Return 503 with user-visible message; do not return partial results |
| Null embedding stored | **Never allowed** — insertion guarded by `embedding IS NOT NULL` check before bulk insert |

---

## 10. Frontend Architecture

### 10.1 Page Structure

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | `LandingPage` | No | Hero, feature highlights, CTA to upload or sign up |
| `/search` | `SearchPage` | No (guest OK) | Main upload + search interface |
| `/dashboard` | `Dashboard` | Yes | Document library, expiry dates, delete actions |
| `/auth/login` | `LoginPage` | No | Email / password login |
| `/auth/register` | `RegisterPage` | No | Sign-up with validation |
| `/auth/forgot-password` | `ForgotPasswordPage` | No | Request reset email |

### 10.2 Key UI Components

**`UploadZone`**
Drag-and-drop file area with MIME type and size validation feedback before upload.

**`IngestionProgress`**
Polls `GET /documents/:id` via React Query until `status === 'ready'`. Shows sentence count on completion.

**`SearchBar`**
Single full-width input styled like a Google search bar; auto-focus on mount; debounced at 300 ms.

**`ResultCard`**
Displays the three-sentence snippet:
```
[context_before — muted]
[content — highlighted / bold]
[context_after — muted]
📄 contract_v2.pdf  •  Page 4  •  91% match
```

**`DocumentLibrary`**
Grid of document cards showing file name, type badge, sentence count, expiry date (warning style if < 3 days), and delete button.

**`GuestBanner`**
Persistent top banner for unauthenticated users. Shows rolling countdown to session expiry; includes sign-up CTA.

### 10.3 Search UX Flow

```
User types query
  → SearchBar debounces 300ms
  → POST /api/v1/search
  → Loading skeleton (3 ResultCard placeholders)
  → Results render with snippet + location metadata
  → User clicks result → modal or side panel shows full document context
```

---

## 11. Security Considerations

| Threat | Mitigation | Severity |
|---|---|---|
| Cross-user data access | `owner_id` / `guest_session_id` filter on **every** sentence query — no naked selects | Critical |
| JWT theft | Short-lived access tokens (1 h); refresh token in `httpOnly` cookie only | High |
| File upload abuse | MIME type check + size limit + temp storage only (files deleted post-ingest) | High |
| SQL injection | Parameterized queries via `pg` library throughout | High |
| Vectorize API outage | Graceful 503; null embeddings never stored | Medium |
| Rate limiting | `express-rate-limit`: 60 req/min per IP on `/search`; 10 req/min on `/documents/upload` | Medium |
| XSS via search results | React's default JSX escaping; no `dangerouslySetInnerHTML` in result rendering | Medium |
| Session fixation (guest) | UUID generated server-side; never accepted from client request body | Low |

---

## 12. Milestones & Delivery Roadmap

### Phase 1 — Core (Weeks 1–3)

**Week 1**
- Project scaffold, Docker Compose (Postgres + pgvector + API + Next.js)
- DB schema migrations (`users`, `guest_sessions`, `documents`, `sentences`)
- Auth module: register, login, JWT middleware, guest session issuance

**Week 2**
- File upload endpoint, text extraction (pdf-parse with page tracking, mammoth, fs)
- Sentence splitting with `compromise` or `sbd`
- Vectorize API integration: batched requests, vector ↔ sentence mapping
- Bulk insert into `sentences` with `context_before` / `context_after`

**Week 3**
- Search endpoint: query vectorization + pgvector cosine similarity
- Basic Next.js search page with `ResultCard` snippet display
- `IngestionProgress` polling component

### Phase 2 — UX Polish (Weeks 4–5)

**Week 4**
- Dashboard with document library, expiry badges, delete actions
- Guest banner with session countdown and sign-up upsell
- Page number display on results (PDF only)

**Week 5**
- Content highlighting in `ResultCard`
- Similarity score display and document filter on search
- Empty state, error states (API unreachable, ingestion failure, no results)

### Phase 3 — Reliability (Week 6)

- `node-cron` cleanup job (guest TTL + 30-day auth TTL)
- Rate limiting middleware
- Integration tests for ingestion and search paths
- Performance test: 10 K sentences, P95 search latency < 2 s
- Production Docker Compose with Nginx reverse proxy

---

## 13. Open Questions

| # | Question | Needed By |
|---|---|---|
| OQ-01 | What is the exact embedding dimension from `/vectorize`? (768 assumed; confirm with `vectors[0].length` before migration) | Before schema creation |
| OQ-02 | Does the `/vectorize` API have rate limits or a per-call cost? Determines retry strategy and whether a queue (BullMQ) is needed for ingestion | Before Phase 1 Week 2 |
| OQ-03 | Should ingestion run synchronously in the request or via an async queue? Queue adds resilience but complexity; for v1 async in-process is acceptable | Phase 1 kickoff |
| OQ-04 | How should very short sentences (e.g., headings, single words) be handled? Options: filter out sentences < 5 tokens; merge with adjacent sentence; store as-is | Before ingestion build |
| OQ-05 | Should users receive an email notification 3 days before their 30-day document expires? | Phase 2 kickoff |
| OQ-06 | What is the production PostgreSQL storage budget? Affects IVFFlat `lists` count (rule: `sqrt(total_sentences)`) | Phase 3 kickoff |

---

## 14. Appendix

### A. Vectorize API Sample

```bash
# Request
curl --location 'https://vector.therohankumar.com/vectorize' \
  --header 'Content-Type: application/json' \
  --data '{ "sentences": ["Hello"] }'

# Response (truncated)
{
  "vectors": [
    [-0.0627, 0.0549, 0.0521, 0.0857, -0.0827, ...]
  ]
}
```

### B. pgvector Search Query

```sql
SELECT
  s.id              AS sentence_id,
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
  d.owner_id = $2                    -- swap for guest_session_id for guests
  AND ($3::uuid[] IS NULL OR d.id = ANY($3))  -- optional document filter
ORDER BY s.embedding <=> $1::vector
LIMIT $4;
```

> Pass the query vector as `$1`, `owner_id` as `$2`, optional `document_ids` array as `$3`, and `top_k` as `$4`.

### C. Sentence Splitter Recommendation

```js
// Option A: compromise (heavier, better accuracy)
import nlp from 'compromise'
const sentences = nlp(text).sentences().out('array')

// Option B: sbd (lightweight, fast)
import { sentences } from 'sbd'
const result = sentences(text, { newline_boundaries: true })
```

For most document types, `sbd` is sufficient and adds minimal bundle weight. Use `compromise` if you observe poor sentence boundary detection on legal or technical documents.

### D. context_before / context_after Population

```js
// After splitting, enrich each sentence with its neighbours
const enriched = sentences.map((sent, i) => ({
  content:        sent,
  sentence_index: i,
  context_before: i > 0             ? sentences[i - 1] : null,
  context_after:  i < sentences.length - 1 ? sentences[i + 1] : null,
}))
```

### E. Glossary

| Term | Definition |
|---|---|
| **Sentence** | The atomic unit of storage — a single sentence extracted from a document, stored with its own vector embedding |
| **Embedding / Vector** | A dense float array representing the semantic meaning of a sentence |
| **Cosine Similarity** | Measure of angular similarity between two vectors; 1 = identical, 0 = orthogonal |
| **pgvector** | PostgreSQL extension enabling vector storage and ANN (approximate nearest-neighbour) search |
| **IVFFlat Index** | pgvector index type; divides vector space into `lists` for faster approximate search |
| **Snippet** | The three-sentence display unit: `context_before` + **match** + `context_after` |
| **TTL** | Time-To-Live; duration after which a record is automatically eligible for deletion |
| **Guest Session** | An anonymous, server-issued UUID identifying an unauthenticated user's temporary data |

---

*SemanticSearch PRD v1.1 — Rohan Kumar — May 2026*