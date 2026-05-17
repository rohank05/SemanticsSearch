"use client";

import { useEffect, useRef } from "react";

interface SearchInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (override?: string) => void;
  busy?: boolean;
  compact?: boolean;
}

export default function SearchInput({ value, onChange, onSubmit, busy, compact }: SearchInputProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!compact) ref.current?.focus(); }, [compact]);

  return (
    <form
      className={`search-form${compact ? " search-form--compact" : ""}`}
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
    >
      <span className="search-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <path d="M15.2 15.2 L20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </span>
      <input
        ref={ref}
        className="search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask anything across your documents…"
        autoComplete="off"
        spellCheck={false}
      />
      {value && !busy && (
        <button
          type="button"
          className="search-clear"
          onClick={() => { onChange(""); onSubmit(""); }}
          aria-label="Clear"
        >
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {busy && <span className="search-spinner" aria-label="Searching" />}
      <button type="submit" className="search-submit" aria-label="Search">
        <kbd>↵</kbd>
      </button>
    </form>
  );
}
