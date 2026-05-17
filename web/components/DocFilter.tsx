"use client";

import MimeBadge from "./MimeBadge";
import type { Doc } from "@/lib/corpus";

interface DocFilterProps {
  docs: Doc[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export default function DocFilter({ docs, selected, onToggle, onClear }: DocFilterProps) {
  return (
    <div className="doc-filter">
      <button
        className={`doc-chip${selected.length === 0 ? " doc-chip--on" : ""}`}
        onClick={onClear}
      >
        <span className="doc-chip-dot" />
        All documents
        <span className="doc-chip-count">{docs.length}</span>
      </button>
      {docs.map((d) => (
        <button
          key={d.id}
          className={`doc-chip${selected.includes(d.id) ? " doc-chip--on" : ""}`}
          onClick={() => onToggle(d.id)}
          title={d.file_name}
        >
          <MimeBadge type={d.mime} />
          <span className="doc-chip-name">{d.short}</span>
        </button>
      ))}
    </div>
  );
}
