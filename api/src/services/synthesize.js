import fetch from "node-fetch";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const MODEL = process.env.OLLAMA_MODEL || "mistral:7b-instruct-q4_K_M";

// Rewrites a short query into a hypothetical document passage (HyDE technique).
// Vectorizing the passage instead of the raw query dramatically improves recall
// because the passage embedding is in the same space as actual document sentences.
// Returns null when Ollama is unavailable or the query is already long enough.
export async function expandQuery(query) {
  if (query.trim().split(/\s+/).length > 10) return null; // already descriptive

  const prompt = `Write one sentence as if it appeared in a document, directly addressing: "${query.trim()}"
Output only the sentence, nothing else.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        stream: false,
        options: { num_predict: 60, temperature: 0.1 },
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const expanded = data.response?.trim().replace(/^["']|["']$/g, "");
    return expanded && expanded.length > 15 ? expanded : null;
  } catch {
    return null;
  }
}

// Returns null if Ollama is unavailable — caller degrades gracefully.
export async function summarizeResults(query, results) {
  if (!results.length) return null;

  const snippets = results
    .slice(0, 6) // cap context to top 6 to keep prompt short
    .map((r, i) => {
      const loc = r.page_number ? `, page ${r.page_number}` : "";
      return `[${i + 1}] "${r.content}" — ${r.document_name}${loc}`;
    })
    .join("\n");

  const prompt = `You are a precise document assistant. Answer the user's query using ONLY the excerpts below.
Be concise (2-4 sentences). Cite sources as [1], [2], etc. If the excerpts don't contain a clear answer, say so briefly.

Query: ${query}

Excerpts:
${snippets}

Answer:`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false }),
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.response?.trim() || null;
  } catch {
    return null; // Ollama down or timed out — search results still return normally
  }
}

export async function isOllamaAvailable() {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(2_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
