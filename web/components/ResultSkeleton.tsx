"use client";

export default function ResultSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="result result--skeleton"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="result-idx skel-block" style={{ height: 12, width: 24 }} />
          <div className="result-body">
            <div className="skel-line w-100" />
            <div className="skel-line w-80" />
            <div className="skel-line w-60" />
            <div className="skel-meta">
              <div className="skel-block w-100" />
              <div className="skel-block w-60" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
