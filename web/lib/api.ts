const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const GUEST_KEY = "guest_session_id";
const getGuestId = () => (typeof localStorage !== "undefined" ? localStorage.getItem(GUEST_KEY) : null);
const setGuestId = (id: string) => typeof localStorage !== "undefined" && localStorage.setItem(GUEST_KEY, id);

const AUTH_KEY = "access_token";
export const getAccessToken = () => (typeof localStorage !== "undefined" ? localStorage.getItem(AUTH_KEY) : null);
export const setAccessToken = (t: string) => typeof localStorage !== "undefined" && localStorage.setItem(AUTH_KEY, t);
export const clearAccessToken = () => typeof localStorage !== "undefined" && localStorage.removeItem(AUTH_KEY);

function guestHeader(): Record<string, string> {
  const id = getGuestId();
  return id ? { "X-Guest-Session-Id": id } : {};
}

function authHeader(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...guestHeader(), ...authHeader(), ...init.headers },
  });
  return res;
}

// ── Guest session ───────────────────────────────────────────────────────────

export async function createGuestSession(): Promise<{ guest_session_id: string }> {
  const res = await apiFetch("/v1/guest/session", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create guest session");
  const data = await res.json();
  setGuestId(data.guest_session_id);
  return data;
}

// ── Documents ───────────────────────────────────────────────────────────────

export interface ApiDocument {
  id: string;
  file_name: string;
  mime_type: string;
  status: "pending" | "processing" | "ready" | "error";
  total_sentences: number;
  expires_at: string;
  created_at: string;
}

export async function uploadDocument(file: File): Promise<{ document_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/v1/documents/upload`, {
    method: "POST",
    credentials: "include",
    headers: { ...guestHeader(), ...authHeader() },
    body: form,
    // no Content-Type header — browser sets multipart boundary automatically
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Upload failed");
  }
  return res.json();
}

export async function getDocument(id: string): Promise<ApiDocument> {
  const res = await apiFetch(`/v1/documents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch document");
  return res.json();
}

export async function getDocumentSentences(id: string): Promise<{ document: ApiDocument; sentences: ApiSentence[] }> {
  const res = await apiFetch(`/v1/documents/${id}/sentences`);
  if (!res.ok) throw new Error("Failed to load document");
  return res.json();
}

export async function listDocuments(): Promise<ApiDocument[]> {
  const res = await apiFetch("/v1/documents");
  if (!res.ok) throw new Error("Failed to list documents");
  const data = await res.json();
  return data.documents;
}

export async function deleteDocument(id: string): Promise<void> {
  const res = await apiFetch(`/v1/documents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete document");
}

// ── Search ──────────────────────────────────────────────────────────────────

export interface ApiSentence {
  id: string;
  sentence_index: number;
  page_number: number | null;
  content: string;
  context_before: string | null;
  context_after: string | null;
}

export interface ApiSearchResult {
  sentence_id: string;
  sentence_index: number;
  document_id: string;
  document_name: string;
  page_number: number | null;
  context_before: string | null;
  content: string;
  context_after: string | null;
  score: number;
}

export interface SearchResponse {
  results: ApiSearchResult[];
  summary: string | null;
  expanded_query: string | null;
  query_vector_ms: number;
  search_ms: number;
  synthesis_ms: number | null;
}

export async function search(
  query: string,
  opts: { document_ids?: string[]; top_k?: number } = {}
): Promise<SearchResponse> {
  const res = await apiFetch("/v1/search", {
    method: "POST",
    body: JSON.stringify({ query, ...opts }),
  });
  if (res.status === 503) throw new Error("Vectorize service unavailable — try again shortly");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Search failed");
  }
  return res.json();
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  const res = await apiFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Login failed");
  }
  const data = await res.json();
  if (data.access_token) setAccessToken(data.access_token);
  return data;
}

export async function register(email: string, password: string) {
  const res = await apiFetch("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Registration failed");
  }
  const data = await res.json();
  if (data.access_token) setAccessToken(data.access_token);
  return data;
}

export async function logout() {
  await apiFetch("/v1/auth/logout", { method: "POST" });
}
