import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash";

function getModel() {
  if (!GEMINI_API_KEY) return null;
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  return genAI.getGenerativeModel({ model: MODEL });
}

// Rewrites a short query into a hypothetical document passage (HyDE technique).
// Returns null when Gemini is unavailable or the query is already long enough.
export async function expandQuery(query) {
  if (query.trim().split(/\s+/).length > 10) return null;

  const model = getModel();
  if (!model) return null;

  const prompt = `Write one sentence as if it appeared in a document, directly addressing: "${query.trim()}"
Output only the sentence, nothing else.`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 80, temperature: 0.1 },
    });
    const expanded = result.response.text().trim().replace(/^["']|["']$/g, "");
    return expanded && expanded.length > 15 ? expanded : null;
  } catch (err) {
    console.error("[Gemini expandQuery]", err?.message ?? err);
    return null;
  }
}

// Returns null if Gemini is unavailable — caller degrades gracefully.
export async function summarizeResults(query, results) {
  if (!results.length) return null;

  const model = getModel();
  if (!model) return null;

  const snippets = results
    .slice(0, 8)
    .map((r, i) => {
      const loc = r.page_number ? `, page ${r.page_number}` : "";
      return `[${i + 1}] "${r.content}" — ${r.document_name}${loc}`;
    })
    .join("\n");

  const prompt = `You are a knowledgeable document assistant. Using ONLY the excerpts below, write a thorough answer to the user's query.

Guidelines:
- Write 3-6 sentences covering the key ideas across all relevant excerpts
- Cite sources inline as [1], [2], etc. after each claim
- If the concept has multiple parts or steps, briefly explain each
- Use plain, clear language — no bullet points, just flowing prose
- If the excerpts don't contain enough information, say so concisely

Query: ${query}

Excerpts:
${snippets}

Answer:`;

  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 600, temperature: 0.3 },
    });
    return result.response.text().trim() || null;
  } catch (err) {
    console.error("[Gemini summarize]", err?.message ?? err);
    return null;
  }
}
