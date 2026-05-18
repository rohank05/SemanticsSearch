"use client";

import MimeBadge from "./MimeBadge";
import type { Doc } from "@/lib/corpus";

interface DocFilterProps {
  publicDocs: Doc[];
  userDocs: Doc[];
  selected: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}

export default function DocFilter({ publicDocs, userDocs, selected, onToggle, onClear }: DocFilterProps) {
  const allDocs = [...publicDocs, ...userDocs];
  return (
    <div className="doc-filter">
      <button
        className={`doc-chip${selected.length === 0 ? " doc-chip--on" : ""}`}
        onClick={onClear}
      >
        <span className="doc-chip-dot" />
        All
        <span className="doc-chip-count">{allDocs.length}</span>
      </button>

      {publicDocs.length > 0 && (
        <>
          <span className="doc-filter-sep">Library</span>
          {publicDocs.map((d) => (
            <button
              key={d.id}
              className={`doc-chip doc-chip--public${selected.includes(d.id) ? " doc-chip--on" : ""}`}
              onClick={() => onToggle(d.id)}
              title={d.file_name}
            >
              <MimeBadge type={d.mime} />
              <span className="doc-chip-name">{d.short}</span>
            </button>
          ))}
        </>
      )}

      {userDocs.length > 0 && (
        <>
          {publicDocs.length > 0 && <span className="doc-filter-sep">My docs</span>}
          {userDocs.map((d) => (
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
        </>
      )}
    </div>
  );
}
