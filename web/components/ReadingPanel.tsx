"use client";

import { useState } from "react";
import MimeBadge from "./MimeBadge";
import HighlightedText from "./HighlightedText";
import type { SearchResult } from "@/lib/corpus";

interface ReadingPanelProps {
  open: boolean;
  result: SearchResult | null;
  query: string;
  onClose: () => void;
}

function formatScore(s: number) { return Math.round(s * 100) + "%"; }

export default function ReadingPanel({ open, result, query, onClose }: ReadingPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!open || !result) return null;
  const { sentence, doc } = result;

  const openInDocument = () => {
    window.open(`/documents/${doc.id}?s=${sentence.id}`, "_blank", "noopener");
  };

  const copyCitation = async () => {
    const pageRef = sentence.page != null ? `, p. ${sentence.page}` : "";
    const text = `"${sentence.content}" — ${doc.file_name}${pageRef}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked */ }
  };

  return (
    <>
      <div className="rp-backdrop" onClick={onClose} />
      <aside className="rp-panel" role="dialog" aria-modal="true">
        <div className="rp-head">
          <div className="rp-doc">
            <MimeBadge type={doc.mime} />
            <span className="rp-doc-name">{doc.file_name}</span>
          </div>
          <button className="rp-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="rp-meta">
          {sentence.page != null && <span><b>Page {sentence.page}</b></span>}
          {sentence.page != null && <span className="dot-sep">·</span>}
          <span>Sentence {sentence.idx + 1}</span>
          <span className="dot-sep">·</span>
          <span className="rp-score">{formatScore(result.score)} match</span>
        </div>

        <div className="rp-page">
          {sentence.context_before && <p className="rp-para muted">{sentence.context_before}</p>}
          <p className="rp-para rp-match">
            <HighlightedText text={sentence.content} query={query} />
          </p>
          {sentence.context_after && <p className="rp-para muted">{sentence.context_after}</p>}
        </div>

        <div className="rp-foot">
          <button className="rp-btn" onClick={openInDocument}>↗ Open in document</button>
          <button className="rp-btn rp-btn--ghost" onClick={copyCitation}>
            {copied ? "✓ Copied" : "Copy citation"}
          </button>
        </div>
      </aside>
    </>
  );
}
