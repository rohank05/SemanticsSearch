"use client";

const MIME_COLORS = {
  pdf:  { bg: "rgba(198,106,59,.10)", fg: "#a04e22", label: "PDF" },
  docx: { bg: "rgba(45,90,150,.10)",  fg: "#1f4878", label: "DOCX" },
  txt:  { bg: "rgba(90,90,86,.10)",   fg: "#4a4a44", label: "TXT" },
} as const;

export default function MimeBadge({ type }: { type: string }) {
  const c = MIME_COLORS[type as keyof typeof MIME_COLORS] ?? { bg: "#eee", fg: "#444", label: type.toUpperCase() };
  return (
    <span className="mime-badge" style={{ background: c.bg, color: c.fg }}>
      {c.label}
    </span>
  );
}
