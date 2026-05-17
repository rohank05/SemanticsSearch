"use client";

import { useState } from "react";
import { login } from "@/lib/api";

interface SignInModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SignInModal({ open, onClose, onSuccess }: SignInModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-wrap" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="rp-close modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        </button>
        <h2 className="modal-h">Keep your library for 30 days</h2>
        <p className="modal-p">Sign in to retain documents past your guest session.</p>
        <form className="modal-fields" onSubmit={handleSubmit}>
          <label className="modal-fld">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label className="modal-fld">
            <span>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="modal-cta" disabled={loading}>
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
        <div className="modal-foot">
          <a href="/auth/register">Create account</a>
          <a href="#">Forgot password</a>
        </div>
      </div>
    </div>
  );
}
