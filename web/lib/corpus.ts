export interface Doc {
  id: string;
  file_name: string;
  short: string;
  mime: "pdf" | "docx" | "txt";
  pages: number | null;
  sentences: number;
  uploaded: string;
  expires_in_days: number;
  is_public: boolean;
  status: "pending" | "processing" | "ready" | "error";
}

export interface Sentence {
  id: string;
  doc_id: string;
  page: number | null;
  idx: number;
  context_before: string | null;
  content: string;
  context_after: string | null;
  tags: string[];
}

export interface SearchResult {
  sentence: Sentence;
  score: number;
  doc: Doc;
}

export const CORPUS_DOCS: Doc[] = [
  {
    id: "doc-msa",
    file_name: "Acme Co. — Master Services Agreement v2.pdf",
    short: "Master Services Agreement",
    mime: "pdf",
    pages: 14,
    sentences: 412,
    uploaded: "3 days ago",
    expires_in_days: 27,
    is_public: false,
    status: "ready" as const,
  },
  {
    id: "doc-att",
    file_name: "Attention Is All You Need — Vaswani et al.pdf",
    short: "Attention Is All You Need",
    mime: "pdf",
    pages: 11,
    sentences: 287,
    uploaded: "1 day ago",
    expires_in_days: 29,
    is_public: false,
    status: "ready" as const,
  },
  {
    id: "doc-lec",
    file_name: "Lecture 04 — Optimization & Backprop.docx",
    short: "Lecture 04 — Optimization",
    mime: "docx",
    pages: null,
    sentences: 156,
    uploaded: "6 hours ago",
    expires_in_days: 30,
    is_public: false,
    status: "ready" as const,
  },
  {
    id: "doc-iso",
    file_name: "Q1 Board Memo — Strategy Review.txt",
    short: "Q1 Board Memo",
    mime: "txt",
    pages: null,
    sentences: 94,
    uploaded: "11 minutes ago",
    expires_in_days: 30,
    is_public: false,
    status: "ready" as const,
  },
];

export const CORPUS: Sentence[] = [
  // Master Services Agreement
  {
    id: "s1", doc_id: "doc-msa", page: 4, idx: 142,
    context_before: "All sales of Services under this Agreement are final and subject to the following terms.",
    content: "Refunds must be requested in writing within fourteen (14) days of the original purchase date.",
    context_after: "After fourteen days, store credit may be issued at the sole discretion of the Service Provider.",
    tags: ["refund", "return", "money back", "reimbursement", "cancel purchase", "refund policy", "two weeks"],
  },
  {
    id: "s2", doc_id: "doc-msa", page: 4, idx: 143,
    context_before: "Refunds must be requested in writing within fourteen (14) days of the original purchase date.",
    content: "After fourteen days, store credit may be issued at the sole discretion of the Service Provider.",
    context_after: "No refunds will be issued for partial usage of subscription periods.",
    tags: ["refund", "store credit", "late return", "discretion"],
  },
  {
    id: "s3", doc_id: "doc-msa", page: 7, idx: 221,
    context_before: "This Agreement shall remain in effect for an initial term of twelve (12) months.",
    content: "Either party may terminate this Agreement for any reason upon sixty (60) days prior written notice.",
    context_after: "Termination for cause requires only thirty (30) days notice and an opportunity to cure.",
    tags: ["terminate", "termination", "cancel agreement", "end contract", "notice period", "exit", "quit", "walk away"],
  },
  {
    id: "s4", doc_id: "doc-msa", page: 7, idx: 222,
    context_before: "Either party may terminate this Agreement for any reason upon sixty (60) days prior written notice.",
    content: "Termination for cause requires only thirty (30) days notice and an opportunity to cure.",
    context_after: "A material breach not cured within the cure period constitutes grounds for immediate termination.",
    tags: ["terminate for cause", "breach", "cure period", "cancel agreement"],
  },
  {
    id: "s5", doc_id: "doc-msa", page: 3, idx: 88,
    context_before: "The parties acknowledge they may exchange sensitive business information in the course of performance.",
    content: '"Confidential Information" shall mean any non-public information disclosed by one party to the other, whether oral, written, or electronic.',
    context_after: "Each party shall protect the other's Confidential Information using the same care it uses for its own.",
    tags: ["NDA", "confidentiality", "private", "non-disclosure", "secret", "proprietary"],
  },
  {
    id: "s6", doc_id: "doc-msa", page: 3, idx: 90,
    context_before: "Each party shall protect the other's Confidential Information using the same care it uses for its own.",
    content: "The obligations of confidentiality shall survive termination of this Agreement for a period of five (5) years.",
    context_after: "Confidential Information does not include information that becomes publicly available through no fault of the receiving party.",
    tags: ["NDA duration", "confidentiality period", "five years", "survive termination", "how long secret"],
  },
  {
    id: "s7", doc_id: "doc-msa", page: 9, idx: 301,
    context_before: "Except for breaches of confidentiality or intellectual property rights, the following limitation applies.",
    content: "The total cumulative liability of either party under this Agreement shall not exceed the fees paid in the twelve (12) months preceding the claim.",
    context_after: "In no event shall either party be liable for indirect, consequential, or punitive damages.",
    tags: ["liability cap", "damages limit", "maximum liability", "exposure", "how much can we be sued", "limitation"],
  },
  {
    id: "s8", doc_id: "doc-msa", page: 6, idx: 188,
    context_before: "Fees for the Services are set forth in the applicable Statement of Work.",
    content: "All invoices are payable in U.S. dollars on net-thirty (Net-30) terms from the date of invoice.",
    context_after: "Past-due amounts accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law.",
    tags: ["payment terms", "net 30", "when do we pay", "invoice", "billing", "due date", "how to pay"],
  },
  {
    id: "s9", doc_id: "doc-msa", page: 5, idx: 160,
    context_before: "Service Provider represents and warrants that it has the authority to enter into this Agreement.",
    content: "The Services will be performed in a professional and workmanlike manner consistent with generally accepted industry standards.",
    context_after: "Customer's sole remedy for breach of this warranty is re-performance of the non-conforming Service.",
    tags: ["warranty", "service quality", "professional standards", "guarantee"],
  },
  {
    id: "s10", doc_id: "doc-msa", page: 11, idx: 360,
    context_before: "The parties intend that all work product be owned by Customer.",
    content: "All deliverables, including any intellectual property rights therein, shall be the sole and exclusive property of Customer upon full payment.",
    context_after: "Service Provider retains ownership of pre-existing materials and general know-how.",
    tags: ["IP ownership", "intellectual property", "who owns the work", "deliverables", "copyright"],
  },
  // Attention Is All You Need
  {
    id: "s11", doc_id: "doc-att", page: 1, idx: 18,
    context_before: "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks.",
    content: "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    context_after: "Experiments on two machine translation tasks show these models to be superior in quality.",
    tags: ["transformer", "architecture", "attention only", "no recurrence", "self-attention model"],
  },
  {
    id: "s12", doc_id: "doc-att", page: 3, idx: 64,
    context_before: "An attention function maps a query and a set of key-value pairs to an output.",
    content: 'We call our particular attention "Scaled Dot-Product Attention" — the input consists of queries and keys of dimension d_k, and values of dimension d_v.',
    context_after: "We compute the dot products of the query with all keys, divide each by sqrt(d_k), and apply a softmax function.",
    tags: ["scaled dot product", "attention math", "how attention works", "queries keys values", "QKV"],
  },
  {
    id: "s13", doc_id: "doc-att", page: 4, idx: 92,
    context_before: "Instead of performing a single attention function, we found it beneficial to linearly project the queries.",
    content: "Multi-head attention allows the model to jointly attend to information from different representation subspaces at different positions.",
    context_after: "With a single attention head, averaging inhibits this.",
    tags: ["multi-head", "attention heads", "parallel attention", "representation subspaces"],
  },
  {
    id: "s14", doc_id: "doc-att", page: 5, idx: 121,
    context_before: "Since our model contains no recurrence and no convolution, we must inject information about token order.",
    content: "We add positional encodings to the input embeddings at the bottoms of the encoder and decoder stacks.",
    context_after: "We use sine and cosine functions of different frequencies for the encoding.",
    tags: ["positional encoding", "position", "order", "sequence position", "sine cosine"],
  },
  {
    id: "s15", doc_id: "doc-att", page: 2, idx: 41,
    context_before: "Most competitive neural sequence transduction models have an encoder-decoder structure.",
    content: "The encoder is composed of a stack of N=6 identical layers, each with a multi-head self-attention sub-layer and a position-wise feed-forward network.",
    context_after: "We employ a residual connection around each of the two sub-layers, followed by layer normalization.",
    tags: ["encoder", "architecture details", "six layers", "self-attention", "feed forward"],
  },
  {
    id: "s16", doc_id: "doc-att", page: 8, idx: 240,
    context_before: "On the WMT 2014 English-to-German translation task, the big Transformer model outperforms the best previously reported models by more than 2.0 BLEU.",
    content: "Our model establishes a new state-of-the-art BLEU score of 28.4 on the WMT 2014 English-to-German translation task.",
    context_after: "On the WMT 2014 English-to-French task, our big model achieves a BLEU score of 41.8.",
    tags: ["BLEU", "results", "benchmark", "translation performance", "state of the art", "SOTA", "WMT"],
  },
  {
    id: "s17", doc_id: "doc-att", page: 8, idx: 248,
    context_before: "We trained the big Transformer model on the WMT 2014 English-German dataset.",
    content: "Training the base models took 12 hours on a single machine with 8 NVIDIA P100 GPUs; the big models trained for 3.5 days.",
    context_after: "This is a small fraction of the training cost of the best models from the literature.",
    tags: ["training time", "compute", "GPU", "how long to train", "P100", "cost"],
  },
  {
    id: "s18", doc_id: "doc-att", page: 6, idx: 175,
    context_before: "In addition to attention sub-layers, each layer in our encoder and decoder contains a fully connected feed-forward network.",
    content: "The feed-forward network consists of two linear transformations with a ReLU activation in between, applied identically and independently at each position.",
    context_after: "The dimensionality of input and output is d_model=512, and the inner-layer has dimensionality d_ff=2048.",
    tags: ["feed forward", "FFN", "MLP", "ReLU", "position-wise"],
  },
  // Lecture 04
  {
    id: "s19", doc_id: "doc-lec", page: null, idx: 24,
    context_before: "When the dataset is large, computing the full gradient on every step becomes prohibitive.",
    content: "Stochastic gradient descent updates the parameters using a noisy estimate of the gradient computed on a single example or a small mini-batch.",
    context_after: "The noise can actually help escape sharp local minima.",
    tags: ["SGD", "stochastic gradient descent", "optimization", "mini-batch", "training loop", "how do we train"],
  },
  {
    id: "s20", doc_id: "doc-lec", page: null, idx: 38,
    context_before: "Plain SGD oscillates heavily in valleys with steep walls but a gentle slope along the bottom.",
    content: "Momentum addresses this by accumulating a velocity vector in directions of persistent reduction of the objective.",
    context_after: "This is analogous to a ball rolling down a hill — it picks up speed in the direction of gravity.",
    tags: ["momentum", "velocity", "optimization", "SGD with momentum", "nesterov", "oscillation"],
  },
  {
    id: "s21", doc_id: "doc-lec", page: null, idx: 47,
    context_before: "A natural extension is to give each parameter its own adaptive learning rate.",
    content: "Adam combines the benefits of momentum with adaptive per-parameter learning rates by maintaining running estimates of the first and second moments of the gradient.",
    context_after: "In practice, Adam is the default optimizer for most deep learning problems.",
    tags: ["adam optimizer", "adaptive learning rate", "default optimizer", "which optimizer should I use", "rmsprop"],
  },
  {
    id: "s22", doc_id: "doc-lec", page: null, idx: 62,
    context_before: "To train any of these optimizers, we need gradients of the loss with respect to every parameter.",
    content: "Backpropagation is the application of the chain rule of calculus to compute these gradients efficiently in a single backward pass through the computational graph.",
    context_after: "Modern frameworks like PyTorch and JAX automate this via reverse-mode autodiff.",
    tags: ["backprop", "backpropagation", "chain rule", "gradients", "how does training work", "autodiff"],
  },
  {
    id: "s23", doc_id: "doc-lec", page: null, idx: 78,
    context_before: "Very deep networks present a particular challenge for gradient-based optimization.",
    content: "The vanishing gradient problem occurs when the magnitude of the gradient shrinks exponentially as it propagates backward through many layers, making early layers effectively untrainable.",
    context_after: "Residual connections and careful initialization largely mitigate this.",
    tags: ["vanishing gradient", "deep networks", "gradient flow", "training issues", "residual", "why is training hard"],
  },
  {
    id: "s24", doc_id: "doc-lec", page: null, idx: 91,
    context_before: "Normalization techniques have become a staple of modern architectures.",
    content: "Batch normalization reduces internal covariate shift by normalizing the activations of a layer across the mini-batch dimension.",
    context_after: "Layer normalization, which normalizes across features instead, is preferred for sequence models and Transformers.",
    tags: ["batch norm", "batchnorm", "normalization", "layer norm", "regularization", "activation"],
  },
  // Q1 Board Memo
  {
    id: "s25", doc_id: "doc-iso", page: null, idx: 8,
    context_before: "Below we summarize the year-end position and proposed strategic shifts for FY26.",
    content: "Revenue grew 38% year-over-year to $14.2M, with gross margin expanding to 71% as infrastructure costs decoupled from headcount growth.",
    context_after: "Net retention sits at 121%, the highest in our segment.",
    tags: ["revenue growth", "YoY", "gross margin", "financial results", "how did we do", "numbers"],
  },
  {
    id: "s26", doc_id: "doc-iso", page: null, idx: 14,
    context_before: "Net retention sits at 121%, the highest in our segment.",
    content: "We recommend reallocating 40% of paid acquisition spend into product-led growth experiments over the next two quarters.",
    context_after: "Initial signal from the self-serve cohort shows 2.4x lower CAC and a 9-day payback.",
    tags: ["strategy", "PLG", "product led growth", "budget reallocation", "marketing spend", "CAC", "paid acquisition"],
  },
  {
    id: "s27", doc_id: "doc-iso", page: null, idx: 22,
    context_before: "Hiring will remain disciplined through FY26.",
    content: "We plan to add 14 engineers, 4 designers, and 6 GTM hires, weighted toward H1 to ensure ramp time before the enterprise push in Q3.",
    context_after: "The full org plan is detailed in Appendix C.",
    tags: ["hiring plan", "headcount", "org chart", "who are we hiring", "team growth", "engineering hires"],
  },
  {
    id: "s28", doc_id: "doc-iso", page: null, idx: 31,
    context_before: "Two competitive risks merit board attention.",
    content: "A well-funded incumbent has begun bundling our core feature into their enterprise tier at no incremental cost, putting pricing pressure on deals above $250K ACV.",
    context_after: "Our differentiation rests on time-to-value and the API quality advantage documented in the customer NPS data.",
    tags: ["competitive risk", "competition", "pricing pressure", "enterprise deals", "bundling", "risks"],
  },
];

export const SUGGESTED_QUERIES = [
  "how do I cancel the contract",
  "what is the refund policy",
  "how does multi-head attention work",
  "training compute requirements",
  "who owns the deliverables",
  "why does training fail on deep networks",
  "revenue growth this year",
  "how long is the NDA",
];

const STOPWORDS = new Set([
  "a","an","the","is","are","was","were","be","been","being","of","to","in","on","for","at","by",
  "with","from","as","it","its","this","that","these","those","i","we","you","they","he","she",
  "me","us","them","my","our","your","their","do","does","did","can","could","should","would",
  "will","shall","may","might","must","have","has","had","what","which","who","whom","whose",
  "how","when","where","why","and","or","but","if","then","so","than","about","into","out","up",
  "down","over","under","again","further","once","any","some","no","not","only","own","same",
  "too","very","s","t","don","now","just","also","really","tell","show","find","give",
]);

export function tokenize(s: string): string[] {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOPWORDS.has(t));
}

function scoreSentence(queryTokens: string[], sent: Sentence): number {
  if (!queryTokens.length) return 0;
  const contentTokens = tokenize(sent.content);
  const tagTokens = tokenize(sent.tags.join(" "));
  const contentSet = new Set(contentTokens);
  const tagSet = new Set(tagTokens);

  let raw = 0;
  let hits = 0;
  for (const q of queryTokens) {
    const inContent = contentSet.has(q);
    const inTags = tagSet.has(q);
    let partial = false;
    if (!inContent && !inTags) {
      for (const c of contentSet) {
        if (c.startsWith(q) || q.startsWith(c)) { partial = true; break; }
      }
      if (!partial) {
        for (const c of tagSet) {
          if (c.startsWith(q) || q.startsWith(c)) { partial = true; break; }
        }
      }
    }
    if (inContent) { raw += 1.0; hits++; }
    else if (inTags) { raw += 1.5; hits++; }
    else if (partial) { raw += 0.4; hits++; }
  }
  const coverage = hits / queryTokens.length;
  const contentLower = sent.content.toLowerCase();
  for (let i = 0; i < queryTokens.length - 1; i++) {
    if (contentLower.includes(queryTokens[i] + " " + queryTokens[i + 1])) raw += 0.7;
  }
  const lenPenalty = Math.min(1, 28 / Math.max(8, sent.content.split(/\s+/).length));
  const normalized = (raw / (queryTokens.length + 1)) * coverage * (0.6 + 0.4 * lenPenalty);
  return Math.min(0.99, normalized + (raw > 0 ? 0.18 : 0));
}

export function searchCorpus(
  query: string,
  { docFilter = null, topK = 10 }: { docFilter?: string[] | null; topK?: number } = {}
): SearchResult[] {
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const docMap = Object.fromEntries(CORPUS_DOCS.map((d) => [d.id, d]));
  return CORPUS
    .filter((s) => !docFilter || docFilter.includes(s.doc_id))
    .map((s) => ({ sentence: s, score: scoreSentence(qTokens, s), doc: docMap[s.doc_id] }))
    .filter((r) => r.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
