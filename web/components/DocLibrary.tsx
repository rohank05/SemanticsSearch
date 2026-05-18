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
  publicDocs: Doc[];
  userDocs: Doc[];
  onUploadClick: () => void;
  ingestingDocs: IngestingDoc[];
}

function DocCard({ d }: { d: Doc }) {
  return (
    <article className="doc-card">
      <div className="doc-card-top">
        <MimeBadge type={d.mime} />
        {!d.is_public && (
          <span className="doc-card-meta-r">
            {d.expires_in_days <= 3 && <span className="warn-pip">⚠</span>}
            {d.expires_in_days} d
          </span>
        )}
      </div>
      <h4 className="doc-card-title">{d.short}</h4>
      <div className="doc-card-stats">
        <span><b>{d.sentences.toLocaleString()}</b> chunks</span>
        {d.pages && <span className="dot-sep">·</span>}
        {d.pages && <span><b>{d.pages}</b> pages</span>}
      </div>
      {!d.is_public && (
        <div className="doc-card-foot">
          <span className="meta-muted">{d.uploaded}</span>
        </div>
      )}
    </article>
  );
}

export default function DocLibrary({ publicDocs, userDocs, onUploadClick, ingestingDocs }: DocLibraryProps) {
  return (
    <div className="doc-lib">
      {publicDocs.length > 0 && (
        <>
          <div className="doc-lib-h">
            <span className="lbl-eyebrow">Library · preloaded textbooks</span>
          </div>
          <div className="doc-lib-grid">
            {publicDocs.map((d) => <DocCard key={d.id} d={d} />)}
          </div>
        </>
      )}

      <div className="doc-lib-h" style={publicDocs.length > 0 ? { marginTop: 20 } : undefined}>
        <span className="lbl-eyebrow">Your documents · ready to search</span>
        <button className="link-btn" onClick={onUploadClick}>＋ Add document</button>
      </div>
      <div className="doc-lib-grid">
        {userDocs.map((d) => <DocCard key={d.id} d={d} />)}

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
          <span className="add-sub">PDF · DOCX · TXT · ≤ 100 MB</span>
        </button>
      </div>
    </div>
  );
}
