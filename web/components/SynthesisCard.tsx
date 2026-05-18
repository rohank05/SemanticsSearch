"use client";

interface Props {
  summary: string | null;
  synthesisMs: number | null;
  loading?: boolean;
}

export default function SynthesisCard({ summary, synthesisMs, loading }: Props) {
  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <span className="synthesis-icon">◈</span>
        <span className="synthesis-label">AI Summary</span>
        {synthesisMs != null && (
          <span className="synthesis-time mono muted">{synthesisMs} ms · phi3:mini</span>
        )}
        {loading && (
          <span className="synthesis-time mono muted">Generating…</span>
        )}
      </div>
      {loading && !summary ? (
        <div className="synthesis-skeleton">
          <span className="synthesis-skel-line" style={{ width: "92%" }} />
          <span className="synthesis-skel-line" style={{ width: "78%" }} />
          <span className="synthesis-skel-line" style={{ width: "85%" }} />
        </div>
      ) : (
        <p className="synthesis-body">{summary}</p>
      )}
    </div>
  );
}
