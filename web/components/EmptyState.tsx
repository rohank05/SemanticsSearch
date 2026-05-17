"use client";

export default function EmptyState({ query, expandedQuery }: { query: string; expandedQuery?: string | null }) {
  return (
    <div className="empty-state">
      <div className="empty-mark">¬</div>
      <h3 className="empty-h">No matches found.</h3>
      <p className="empty-p">
        {expandedQuery
          ? <>The system looked for passages about <em>{expandedQuery.toLowerCase().replace(/\.$/, "")}</em> but found nothing relevant in your documents.</>
          : <>Nothing in your documents closely matches <span className="empty-q">&ldquo;{query}&rdquo;</span>.</>
        }
      </p>
      <p className="empty-p">Try uploading a document that covers this topic, or rephrase with more context.</p>
    </div>
  );
}
