"use client";

import { tokenize } from "@/lib/corpus";
import { Fragment } from "react";

function highlightInSentence(sentence: string, query: string) {
  if (!query.trim()) return sentence;
  const qTokens = tokenize(query);
  if (!qTokens.length) return sentence;
  const escaped = qTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`\\b(${escaped.join("|")})(s|es|ing|ed)?\\b`, "gi");
  const parts: { type: "t" | "h"; text: string }[] = [];
  let last = 0;
  for (const m of sentence.matchAll(pattern)) {
    if (m.index! > last) parts.push({ type: "t", text: sentence.slice(last, m.index) });
    parts.push({ type: "h", text: m[0] });
    last = m.index! + m[0].length;
  }
  if (last < sentence.length) parts.push({ type: "t", text: sentence.slice(last) });
  return parts;
}

export default function HighlightedText({ text, query }: { text: string; query: string }) {
  const parts = highlightInSentence(text, query);
  if (typeof parts === "string") return <>{parts}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.type === "h"
          ? <mark key={i} className="match-hl">{p.text}</mark>
          : <Fragment key={i}>{p.text}</Fragment>
      )}
    </>
  );
}
