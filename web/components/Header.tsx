"use client";

import { useEffect, useState } from "react";

interface HeaderProps {
  onSignIn: () => void;
  isAuthed?: boolean;
}

export default function Header({ onSignIn, isAuthed = false }: HeaderProps) {
  const [seconds, setSeconds] = useState(600);

  useEffect(() => {
    if (isAuthed) return;
    const id = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [isAuthed]);

  const mm = String(Math.floor(seconds / 60));
  const ss = String(seconds % 60).padStart(2, "0");
  const warn = seconds < 120;

  return (
    <header className="site-hd">
      <div className="wm">
        <span className="wm-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M14.8 14.8 L20 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="10" cy="10" r="2.2" fill="currentColor" opacity=".25" />
          </svg>
        </span>
        <span className="wm-name">
          semantic<span className="wm-italic">search</span>
        </span>
      </div>

      <nav className="site-nav">
        {isAuthed ? (
          <div className="guest-pill" title="Signed in — documents saved for 30 days">
            <span className="pulse-dot" style={{ background: "var(--ok)" }} />
            <span className="guest-pill-lbl">Signed in</span>
          </div>
        ) : (
          <div className={`guest-pill${warn ? " guest-pill--warn" : ""}`} title="Guest session — data deleted after countdown">
            <span className="pulse-dot" />
            <span className="guest-pill-lbl">Guest</span>
            <span className="guest-pill-sep">·</span>
            <span className="guest-pill-time">{mm}:{ss}</span>
            <span className="guest-pill-suffix">left</span>
          </div>
        )}
        {!isAuthed && <button className="nav-btn" onClick={onSignIn}>Sign in</button>}
      </nav>
    </header>
  );
}
