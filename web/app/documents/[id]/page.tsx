"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { getDocumentSentences } from "@/lib/api";
import type { ApiSentence, ApiDocument } from "@/lib/api";
import MimeBadge from "@/components/MimeBadge";

function mimeFromType(t: string): "pdf" | "docx" | "txt" {
  if (t.includes("pdf")) return "pdf";
  if (t.includes("word") || t.includes("docx")) return "docx";
  return "txt";
}

export default function DocumentViewerPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const docId = params.id as string;
  const targetId = searchParams.get("s");

  const [doc, setDoc] = useState<ApiDocument | null>(null);
  const [sentences, setSentences] = useState<ApiSentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const targetRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    getDocumentSentences(docId)
      .then(({ document, sentences }) => {
        setDoc(document);
        setSentences(sentences);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load document"))
      .finally(() => setLoading(false));
  }, [docId]);

  useEffect(() => {
    if (targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [sentences]);

  // Group sentences by page_number (null → page 1)
  const pages = sentences.reduce<Record<number, ApiSentence[]>>((acc, s) => {
    const p = s.page_number ?? 1;
    (acc[p] ??= []).push(s);
    return acc;
  }, {});
  const pageNumbers = Object.keys(pages).map(Number).sort((a, b) => a - b);
  const multiPage = pageNumbers.length > 1;

  return (
    <div className="dv-shell">
      <header className="dv-hd">
        <button className="dv-back" onClick={() => router.back()}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
            <path d="M15 18 L9 12 L15 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        {doc && (
          <div className="dv-doc-info">
            <MimeBadge type={mimeFromType(doc.mime_type)} />
            <span className="dv-doc-name">{doc.file_name}</span>
            <span className="dot-sep">·</span>
            <span className="muted">{doc.total_sentences.toLocaleString()} sentences</span>
          </div>
        )}
      </header>

      <main className="dv-main">
        {loading && (
          <div className="dv-state">
            <div className="dv-spinner" />
            <span>Loading document…</span>
          </div>
        )}
        {error && (
          <div className="dv-state">
            <div style={{ fontSize: 28 }}>⚠</div>
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div className="dv-content">
            {pageNumbers.map((page) => (
              <section key={page} className="dv-page">
                {multiPage && <div className="dv-page-label">Page {page}</div>}
                <div className="dv-para">
                  {pages[page].map((s) => {
                    const isTarget = s.id === targetId;
                    return (
                      <span
                        key={s.id}
                        ref={isTarget ? targetRef : undefined}
                        className={`dv-sentence${isTarget ? " dv-sentence--target" : ""}`}
                        id={`s-${s.id}`}
                      >
                        {s.content}{" "}
                      </span>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
