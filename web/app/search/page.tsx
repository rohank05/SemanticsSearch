"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import SearchInput from "@/components/SearchInput";
import DocLibrary from "@/components/DocLibrary";
import DocFilter from "@/components/DocFilter";
import ResultCard from "@/components/ResultCard";
import ResultSkeleton from "@/components/ResultSkeleton";
import EmptyState from "@/components/EmptyState";
import ReadingPanel from "@/components/ReadingPanel";
import SignInModal from "@/components/SignInModal";
import SynthesisCard from "@/components/SynthesisCard";
import { SUGGESTED_QUERIES } from "@/lib/corpus";
import type { SearchResult } from "@/lib/corpus";
import {
  createGuestSession,
  uploadDocument,
  getDocument,
  listDocuments,
  search,
} from "@/lib/api";
import type { ApiDocument, ApiSearchResult } from "@/lib/api";

type Phase = "idle" | "searching" | "results";
type Density = "compact" | "regular" | "comfy";

interface IngestingDoc {
  key: string;
  id: string;
  file_name: string;
  short: string;
  mime: string;
  status: string;
  step: string;
  progress: number;
}

interface Stats {
  results: number;
  queryVectorMs: number;
  searchMs: number;
  synthesisMs: number | null;
}

// Map API result shape → the SearchResult shape ResultCard expects
function toSearchResult(r: ApiSearchResult): SearchResult {
  const mimeFromName = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return "pdf";
    if (ext === "docx") return "docx";
    return "txt";
  };
  return {
    sentence: {
      id: r.sentence_id,
      doc_id: r.document_id,
      page: r.page_number,
      idx: r.sentence_index,
      context_before: r.context_before,
      content: r.content,
      context_after: r.context_after,
      tags: [],
    },
    score: r.score,
    doc: {
      id: r.document_id,
      file_name: r.document_name,
      short: r.document_name.replace(/\.[^.]+$/, "").slice(0, 38),
      mime: mimeFromName(r.document_name) as "pdf" | "docx" | "txt",
      pages: null,
      sentences: 0,
      uploaded: "",
      expires_in_days: 30,
    },
  };
}

// Map ApiDocument → the Doc shape DocLibrary/DocFilter expect
function toDoc(d: ApiDocument) {
  const mimeFromType = (t: string) => {
    if (t.includes("pdf")) return "pdf" as const;
    if (t.includes("word") || t.includes("docx")) return "docx" as const;
    return "txt" as const;
  };
  const expiresInDays = Math.max(
    0,
    Math.round((new Date(d.expires_at).getTime() - Date.now()) / 86_400_000)
  );
  return {
    id: d.id,
    file_name: d.file_name,
    short: d.file_name.replace(/\.[^.]+$/, "").slice(0, 38),
    mime: mimeFromType(d.mime_type),
    pages: null,
    sentences: d.total_sentences,
    uploaded: new Date(d.created_at).toLocaleDateString(),
    expires_in_days: expiresInDays,
  };
}

// Poll a document until status is ready or error (max 60 s)
async function pollUntilReady(
  docId: string,
  onProgress: (step: string, progress: number) => void
): Promise<ApiDocument> {
  const STEP_MAP: Record<string, [string, number]> = {
    pending:    ["Validating file…", 8],
    processing: ["Processing…", 55],
    ready:      ["Ready", 100],
    error:      ["Error", 100],
  };
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const doc = await getDocument(docId);
    const [step, progress] = STEP_MAP[doc.status] ?? ["Processing…", 50];
    // Fake granular progress while processing
    const fakeProgress = doc.status === "processing" ? 20 + Math.min(75, i * 5) : progress;
    onProgress(step, fakeProgress);
    if (doc.status === "ready" || doc.status === "error") return doc;
  }
  throw new Error("Ingestion timed out");
}

export default function SearchPage() {
  const [query, setQuery]           = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [docFilter, setDocFilter]   = useState<string[]>([]);
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [phase, setPhase]           = useState<Phase>("idle");
  const [openResult, setOpenResult] = useState<SearchResult | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [ingestingDocs, setIngestingDocs] = useState<IngestingDoc[]>([]);
  const [stats, setStats]           = useState<Stats | null>(null);
  const [summary, setSummary]       = useState<string | null>(null);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);
  const [docs, setDocs]             = useState<ReturnType<typeof toDoc>[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [density]                   = useState<Density>("regular");
  const [showScore]                 = useState(true);
  const [showContext]               = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const guestInitRef = useRef(false);

  // Ensure guest session cookie exists before first upload
  const ensureGuestSession = useCallback(async () => {
    if (guestInitRef.current) return;
    guestInitRef.current = true;
    try {
      await createGuestSession();
    } catch {
      // Session may already exist — not fatal
    }
  }, []);

  // Load real document library on mount
  useEffect(() => {
    listDocuments()
      .then((apiDocs) => setDocs(apiDocs.filter((d) => d.status === "ready").map(toDoc)))
      .catch(() => {}); // Not signed in yet — silently skip
  }, []);

  // Debounced search — hits real API
  useEffect(() => {
    if (!query.trim()) {
      setPhase("idle"); setResults([]); setActiveQuery(""); setStats(null); setSummary(null); setExpandedQuery(null); setSearchError(null);
      return;
    }
    setPhase("searching");
    setSearchError(null);
    const id = setTimeout(async () => {
      try {
        const data = await search(query, {
          document_ids: docFilter.length ? docFilter : undefined,
          top_k: 12,
        });
        setResults(data.results.map(toSearchResult));
        setSummary(data.summary ?? null);
        setExpandedQuery(data.expanded_query ?? null);
        setActiveQuery(query);
        setStats({
          results: data.results.length,
          queryVectorMs: data.query_vector_ms,
          searchMs: data.search_ms,
          synthesisMs: data.synthesis_ms ?? null,
        });
        setPhase("results");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Search failed";
        setSearchError(msg);
        setResults([]);
        setSummary(null);
        setExpandedQuery(null);
        setPhase("results");
      }
    }, 600);
    return () => clearTimeout(id);
  }, [query, docFilter]);

  const handleSubmit = (override?: string) => {
    if (typeof override === "string") setQuery(override);
  };

  const toggleDoc = (id: string) =>
    setDocFilter((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleFilesChosen = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files); // snapshot before any await — FileList is live and cleared by e.target.value=""
    await ensureGuestSession();

    const uploadOne = async (file: File) => {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      const ext = (file.name.split(".").pop() ?? "").toLowerCase();
      const mime = ["pdf", "docx", "txt"].includes(ext) ? ext : "txt";
      const short = file.name.replace(/\.[^.]+$/, "").slice(0, 38);

      const patch = (updates: Partial<IngestingDoc>) =>
        setIngestingDocs((prev) => prev.map((d) => d.key === key ? { ...d, ...updates } : d));

      setIngestingDocs((prev) => [
        ...prev,
        { key, id: key, file_name: file.name, short, mime, status: "pending", step: "Uploading…", progress: 4 },
      ]);

      try {
        const { document_id } = await uploadDocument(file);
        patch({ id: document_id, step: "Extracting text…", progress: 12 });

        const finished = await pollUntilReady(document_id, (step, progress) => {
          patch({ step, progress, status: "processing" });
        });

        if (finished.status === "ready") {
          setDocs((prev) => [toDoc(finished), ...prev]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        patch({ step: msg, progress: 100, status: "error" });
        setTimeout(() => setIngestingDocs((prev) => prev.filter((d) => d.key !== key)), 3000);
        return;
      }
      setTimeout(() => setIngestingDocs((prev) => prev.filter((d) => d.key !== key)), 1400);
    };

    fileArray.forEach((f) => uploadOne(f));
  };

  const docCount = docFilter.length || docs.length;

  return (
    <div className="app">
      <Header onSignIn={() => setSignInOpen(true)} />

      <main className={`main${phase === "idle" ? " main--hero" : ""}`}>
        {phase === "idle" && (
          <section className="hero">
            <p className="eyebrow">Semantic search · sentence-level retrieval</p>
            <h1 className="hero-h">
              Search your documents{" "}
              <span className="serif-it">like you think.</span>
            </h1>
            <p className="hero-sub">
              Ask anything in plain English. Every match returns the exact sentence,
              its surrounding context, and a citation back to the page.
            </p>

            <SearchInput value={query} onChange={setQuery} onSubmit={handleSubmit} />

            <div className="suggested">
              <span className="suggested-lbl">Try</span>
              <div className="suggested-chips">
                {SUGGESTED_QUERIES.slice(0, 4).map((q) => (
                  <button key={q} className="sugg-chip" onClick={() => setQuery(q)}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <DocLibrary
              docs={docs}
              onUploadClick={() => fileInputRef.current?.click()}
              ingestingDocs={ingestingDocs}
            />
          </section>
        )}

        {phase !== "idle" && (
          <section className="results-view">
            <div className="results-top">
              <SearchInput
                value={query}
                onChange={setQuery}
                onSubmit={handleSubmit}
                busy={phase === "searching"}
                compact
              />
              {docs.length > 0 && (
                <DocFilter
                  docs={docs}
                  selected={docFilter}
                  onToggle={toggleDoc}
                  onClear={() => setDocFilter([])}
                />
              )}
            </div>

            {phase === "searching" && (
              <>
                <div className="results-stats results-stats--ghost">
                  Searching{docCount > 0 ? ` across ${docCount} document${docCount !== 1 ? "s" : ""}` : ""}…
                </div>
                <div className="results-list"><ResultSkeleton /></div>
              </>
            )}

            {phase === "results" && (
              <>
                {searchError ? (
                  <div className="empty-state">
                    <div className="empty-mark">⚠</div>
                    <h3 className="empty-h">Search unavailable</h3>
                    <p className="empty-p">{searchError}</p>
                  </div>
                ) : stats && (
                  <>
                    <div className="results-stats">
                      <span><b>{stats.results}</b> result{stats.results !== 1 ? "s" : ""}</span>
                      <span className="dot-sep">·</span>
                      <span><span className="mono">/vectorize</span> in <b>{stats.queryVectorMs}</b> ms</span>
                      <span className="dot-sep">·</span>
                      <span>pgvector in <b>{stats.searchMs}</b> ms</span>
                      <span className="dot-sep">·</span>
                      <span className="mono muted">cosine ≥ 0.18</span>
                    </div>
                    {expandedQuery && results.length > 0 && (
                      <div className="intent-hint">
                        <span className="intent-label">understood as</span>
                        <span className="intent-text">{expandedQuery}</span>
                      </div>
                    )}
                    {results.length === 0 ? (
                      <EmptyState query={activeQuery} expandedQuery={expandedQuery} />
                    ) : (
                      <>
                        {summary && (
                          <SynthesisCard summary={summary} synthesisMs={stats?.synthesisMs ?? null} />
                        )}
                        <div className="results-list">
                          {results.map((r, i) => (
                            <ResultCard
                              key={r.sentence.id}
                              result={r}
                              query={activeQuery}
                              idx={i}
                              density={density}
                              showScore={showScore}
                              showContext={showContext}
                              onOpen={setOpenResult}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </>
            )}

            {ingestingDocs.length > 0 && (
              <div className="ingest-toast">
                {ingestingDocs.map((doc) => (
                  <div key={doc.key} className="ingest-toast-item">
                    <div className="ingest-toast-h">
                      <span className="pulse-dot pulse-dot--accent" />
                      <b>Ingesting {doc.short}</b>
                      <span className="ingest-toast-pct">{doc.progress}%</span>
                    </div>
                    <div className="ingest-progress">
                      <div className="ingest-bar" style={{ width: `${doc.progress}%` }} />
                    </div>
                    <div className="ingest-step">{doc.step}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="site-ft">
        <span className="mono">SemanticSearch v1.1</span>
        <span className="dot-sep">·</span>
        <span className="muted">vector.therohankumar.com/vectorize · 384-dim · cosine</span>
        <span className="grow" />
        <span className="mono muted">Press <kbd>/</kbd> to focus</span>
      </footer>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: "none" }}
        multiple
        onChange={(e) => { handleFilesChosen(e.target.files); e.target.value = ""; }}
      />

      <ReadingPanel
        open={!!openResult}
        result={openResult}
        query={activeQuery}
        onClose={() => setOpenResult(null)}
      />

      <SignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
    </div>
  );
}
