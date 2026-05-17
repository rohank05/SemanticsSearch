"use client";

import MimeBadge from "./MimeBadge";
import type { Doc } from "@/lib/corpus";

interface IngestingDoc {
  key: string;
  file_name: string;
  short: string;
  mime: string;
  status: string;
  step: string;
  progress: number;
}

interface DocLibraryProps {
  docs: Doc[];
  onUploadClick: () => void;
  ingestingDocs: IngestingDoc[];
}

export default function DocLibrary({ docs, onUploadClick, ingestingDocs }: DocLibraryProps) {
  return (
    <div className="doc-lib">
      <div className="doc-lib-h">
        <span className="lbl-eyebrow">Indexed · ready to search</span>
        <button className="link-btn" onClick={onUploadClick}>＋ Add document</button>
      </div>
      <div className="doc-lib-grid">
        {docs.map((d) => (
          <article key={d.id} className="doc-card">
            <div className="doc-card-top">
              <MimeBadge type={d.mime} />
              <span className="doc-card-meta-r">
                {d.expires_in_days <= 3 && <span className="warn-pip">⚠</span>}
                {d.expires_in_days} d
              </span>
            </div>
            <h4 className="doc-card-title">{d.short}</h4>
            <div className="doc-card-stats">
              <span><b>{d.sentences.toLocaleString()}</b> sentences</span>
              {d.pages && <span className="dot-sep">·</span>}
              {d.pages && <span><b>{d.pages}</b> pages</span>}
            </div>
            <div className="doc-card-foot">
              <span className="meta-muted">{d.uploaded}</span>
            </div>
          </article>
        ))}

        {ingestingDocs.map((doc) => (
          <article key={doc.key} className="doc-card doc-card--ingest" data-error={doc.status === "error" ? "true" : undefined}>
            <div className="doc-card-top">
              <MimeBadge type={doc.mime} />
              <span className="ingest-tag">{doc.status === "error" ? "error" : doc.status}</span>
            </div>
            <h4 className="doc-card-title">{doc.short}</h4>
            <div className="ingest-progress">
              <div className="ingest-bar" style={{ width: `${doc.progress}%` }} />
            </div>
            <div className="ingest-step">{doc.step}</div>
          </article>
        ))}

        <button className="doc-card doc-card--add" onClick={onUploadClick}>
          <span className="add-icon">＋</span>
          <span className="add-label">Drop file or browse</span>
          <span className="add-sub">PDF · DOCX · TXT · ≤ 10 MB</span>
        </button>
      </div>
    </div>
  );
}
