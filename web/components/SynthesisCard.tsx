"use client";

interface Props {
  summary: string;
  synthesisMs: number | null;
}

export default function SynthesisCard({ summary, synthesisMs }: Props) {
  return (
    <div className="synthesis-card">
      <div className="synthesis-header">
        <span className="synthesis-icon">◈</span>
        <span className="synthesis-label">AI Summary</span>
        {synthesisMs != null && (
          <span className="synthesis-time mono muted">{synthesisMs} ms · Mistral 7B</span>
        )}
      </div>
      <p className="synthesis-body">{summary}</p>
    </div>
  );
}
