import fetch from "node-fetch";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";

// Ollama /api/embed supports batch input — send up to BATCH_SIZE texts at once.
const BATCH_SIZE = 16;

export async function vectorizeSentences(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const res = await fetch(`${OLLAMA_URL}/api/embed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ollama embed error ${res.status}: ${text}`);
    }
    const data = await res.json();
    vectors.push(...data.embeddings);
  }
  return vectors;
}

export async function vectorizeQuery(query) {
  const vecs = await vectorizeSentences([query]);
  return vecs[0];
}
