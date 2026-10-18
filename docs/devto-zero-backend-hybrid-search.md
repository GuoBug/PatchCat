---
title: Zero-Backend AI: Running Local Embeddings, BM25, and Hybrid RRF Search 100% in the Browser
published: true
description: Why pay monthly cloud bills for hosted vector databases when modern browsers can run quantized embeddings, an in-memory BM25 index, and reciprocal rank fusion locally? Here is the architecture, code, and trade-offs.
tags: webdev, ai, javascript, architecture
cover_image: https://guobug.github.io/assets/images/flowchart-bm25-rrf-hybrid-search.svg
---

> Open-Source Repository: [GitHub - PatchCat](https://github.com/GuoBug/PatchCat)  
> Live Interactive Demo: [PatchCat Studio](https://guobug.github.io/PatchCat/)  

---

For 90% of client-facing tools, personal productivity apps, and desktop-grade workflows, spinning up Pinecone or Weaviate is architectural overkill.

Cloud vector databases bring three acute penalties: round-trip network latency on every keystroke, recurring monthly bills, and the permanent exfiltration of private user data to third-party servers.

While building PatchCat—an open-source **AI Workflow Orchestration** studio designed as a local-first **DAG Engine**—we eliminated the backend vector cluster entirely. Instead, we run neural embeddings, sparse lexical indexing, and ranking algorithms straight inside the browser.

Here is the condensed architecture, the core logic, and the practical trade-offs.

![PatchCat Dual-Channel Hybrid Retrieval](https://guobug.github.io/assets/images/flowchart-bm25-rrf-hybrid-search.svg)

## 1. Why Pure Vector Search Fails on Real Workflows

Dense vector embeddings excel at fuzzy semantic matching, but fail on exact keywords.

In an **AI Workflow Orchestration** canvas:
- Searching `"app crash"` correctly matches documents talking about `"application freeze"`.
- But searching a specific error code like `DAG_CYCLE_DETECTED` or an RFC spec like `RFC-7519` causes pure vector search to fail. The model projects the token into a generic vector subspace, returning irrelevant graph theory text instead of the exact error definition.

Conversely, BM25 inverted indexes pinpoint exact error codes, but fail when synonyms diverge. To achieve production reliability in a **State Machine** without server-side re-rankers, you need both channels combined via Reciprocal Rank Fusion (RRF).

## 2. Channel A: Smoothed In-Memory BM25 (Zero Dependencies)

Standard BM25 formulas yield negative scores when a query term appears in more than half the corpus. In local knowledge bases, this penalizes relevant documents containing common domain terms.

We use the non-negative smoothed Robertson-Spärck Jones variant:

$$\text{IDF}(q_i) = \ln \left( 1 + \frac{N - n(q_i) + 0.5}{n(q_i) + 0.5} \right)$$

Here is the core scoring loop in pure TypeScript:

```typescript
// Core BM25 score calculation without negative IDF anomalies
function scoreDocument(
  termFreq: number,
  docLen: number,
  avgDocLen: number,
  n_q: number,
  totalDocs: number,
  k1 = 1.2,
  b = 0.75
): number {
  // Non-negative smoothed IDF
  const idf = Math.log(1 + (totalDocs - n_q + 0.5) / (n_q + 0.5));
  const numerator = termFreq * (k1 + 1);
  const denominator = termFreq + k1 * (1 - b + b * (docLen / avgDocLen));
  return idf * (numerator / denominator);
}
```

For tokenization, we use a lightweight regex tokenizer that splits English words by whitespace and slices CJK characters into zero-dictionary bi-grams.

## 3. Channel B: Neural Embeddings in a Web Worker

Running transformer models on the main browser thread causes frame drops during canvas dragging.

We isolate a quantized BGE-small ONNX model (~35MB) inside a dedicated `Web Worker`. The model downloads once on initial visit, caches in the browser's `CacheStorage`, and computes 384-dimensional dense vectors asynchronously.

Because vectors are pre-normalized to unit length ($L_2 = 1$), cosine similarity reduces to a fast linear dot product across a continuous `Float32Array`:

```typescript
// Fast dot-product scan across pre-normalized Float32Array vectors
function dotProduct(a: Float32Array, b: Float32Array): number {
  let sum = 0.0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}
```

## 4. Channel C: Reciprocal Rank Fusion (RRF)

Dense cosine similarities range from `0.60` to `0.95`. BM25 scores are unbounded positive numbers. You cannot naively average them without brittle normalization hacks.

Reciprocal Rank Fusion operates strictly on ordinal ranking positions:

$$RRF(d) = \sum_{m \in M} \frac{1}{k + \text{rank}_m(d)} \quad (k = 60)$$

```typescript
export function rrf(
  bm25Ranks: string[], // Ordered doc IDs from BM25
  vectorRanks: string[], // Ordered doc IDs from Vector search
  k = 60
): Array<{ id: string; score: number }> {
  const scores = new Map<string, number>();

  [bm25Ranks, vectorRanks].forEach((ranks) => {
    ranks.forEach((id, index) => {
      const rank = index + 1;
      scores.set(id, (scores.get(id) || 0) + 1 / (k + rank));
    });
  });

  return Array.from(scores.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}
```

If an error code ranks #1 in BM25 and #15 in Vector search, its RRF score easily beats candidates sitting at mediocre ranks in both channels.

## 5. Engineering Trade-offs

Moving search to the browser comes with clear boundaries:

| Dimension | Cloud Vector DB | Browser-Native Pipeline (PatchCat) |
| :--- | :--- | :--- |
| Data Privacy | Data leaves device to SaaS | 100% Client-Only; zero network exfiltration |
| Infrastructure Cost | $50–$200+/mo | $0.00 |
| Cold Start | 0MB download | ~35MB model download on first visit |
| Client Memory | Negligible | ~150MB heap in Web Worker |
| Practical Scale | Millions of records | ~5,000 to 20,000 text chunks |

### Best Fits:
- Local-first desktop productivity apps (note-taking, prompt editors, local IDEs);
- BYOK (Bring Your Own Key) apps where developers want zero server liability;
- Searching within active projects or open documents with sub-50ms latency.

If you are building an enterprise search engine across millions of global users, stick to a central cluster. But for private, client-side workflows, modern browsers can handle hybrid RAG entirely on their own.

---

> **About the Author**  
> **Guo Qiang (GuoBug)** is a Product Engineer bridging platform engineering foundations with product growth mechanics. Currently architecting **AI Workflow Orchestration**, **DAG Engine** state machines, and deterministic browser-native systems.  
> Projects & Home: [https://github.com/GuoBug](https://github.com/GuoBug) · [https://guobug.github.io](https://guobug.github.io)  
> Open to discussions on workflow engine architectures, topological scheduling, and low-friction developer experiences.
