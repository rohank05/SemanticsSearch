"use client";

import MimeBadge from "./MimeBadge";
import HighlightedText from "./HighlightedText";
import type { SearchResult } from "@/lib/corpus";

interface ResultCardProps {
  result: SearchResult;
  query: string;
  idx: number;
  density: "compact" | "regular" | "comfy";
  showScore: boolean;
  showContext: boolean;
  onOpen: (r: SearchResult) => void;
}

function formatScore(s: number) { return Math.round(s * 100) + "%"; }

export default function ResultCard({ result, query, idx, density, showScore, showContext, onOpen }: ResultCardProps) {
  const { sentence, score, doc } = result;
  return (
    <article className={`result result--${density}`} onClick={() => onOpen(result)}>
      <div className="result-idx">{String(idx + 1).padStart(2, "0")}</div>
      <div className="result-body">
        <p className="result-snippet">
          {showContext && sentence.context_before && (
            <span className="ctx">{sentence.context_before} </span>
          )}
          <span className="match">
            <HighlightedText text={sentence.content} query={query} />
          </span>
          {showContext && sentence.context_after && (
            <span className="ctx"> {sentence.context_after}</span>
          )}
        </p>
        <div className="result-meta">
          <span className="meta-doc">
            <MimeBadge type={doc.mime} />
            <span className="meta-doc-name">{doc.short}</span>
          </span>
          {sentence.page != null && (
            <span className="meta-pip">
              <span className="dot-sep">·</span> Page {sentence.page}
            </span>
          )}
          <span className="meta-pip">
            <span className="dot-sep">·</span> Sentence {sentence.idx}
          </span>
          {showScore && (
            <span className="score-pill" title="Cosine similarity">
              <span className="score-bar">
                <span className="score-bar-fill" style={{ width: `${score * 100}%` }} />
              </span>
              <span className="score-pct">{formatScore(score)}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
