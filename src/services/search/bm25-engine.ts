/**
 * @file    src/services/search/bm25-engine.ts
 * @version 1.0.0
 * @description
 *   Lightweight, zero-external-dependency BM25 Lexical Inverted Index & Tokenizer Engine for PatchCat.
 *   Features:
 *     - Mixed English/Number + CJK Bi-gram tokenization with unigram fallback.
 *     - Built-in bilingual stopword filtering.
 *     - Robertson-Spärck Jones smoothed non-negative IDF calculation.
 *     - Document length normalization (k1, b) and Min-Max / Max-Score ranking normalization.
 *     - Multi-channel Reciprocal Rank Fusion (RRF) with channel observability.
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1. Types & Interfaces
// ─────────────────────────────────────────────────────────────────────────────

export interface TokenizeOptions {
  /** Whether to filter out built-in and custom stopwords. Default: true */
  removeStopwords?: boolean;
  /** Whether to generate overlapping bi-grams for CJK characters. Default: true */
  cjkBiGram?: boolean;
  /** Fallback to unigram when CJK sequence length is 1 or no bi-gram can form. Default: true */
  cjkUnigramFallback?: boolean;
  /** Additional custom stopwords or custom stopword collection */
  customStopwords?: Set<string> | string[];
  /** Minimum length for alphanumeric tokens. Default: 2 */
  minAlphaNumLength?: number;
}

export interface BM25Options {
  /** Term frequency saturation parameter. Default: 1.5 */
  k1?: number;
  /** Document length penalization parameter. Default: 0.75 */
  b?: number;
  /** Options passed to the tokenizer */
  tokenizeOptions?: TokenizeOptions;
}

export interface BM25DocumentRecord<T = unknown> {
  id: string;
  text: string;
  tokens: string[];
  termFrequencies: Map<string, number>;
  length: number;
  metadata?: T;
}

export interface BM25SearchResult<T = unknown> {
  id: string;
  score: number;
  normalizedScore: number;
  matchedTerms: string[];
  metadata?: T;
}

export interface RankedItem<T = unknown> {
  id: string;
  score?: number;
  item: T;
}

export interface RankedList<T = unknown> {
  name?: string;
  weight?: number;
  items: Array<RankedItem<T>>;
}

export interface RRFChannelDetail {
  channelIndex: number;
  channelName: string;
  rank: number;
  rawScore?: number;
  rrfScore: number;
}

export interface RRFScoredItem<T = unknown> {
  id: string;
  score: number;
  item: T;
  channelDetails: RRFChannelDetail[];
}

export interface RRFOptions {
  /** Smoothing constant in RRF formula (1 / (k + rank)). Default: 60 */
  k?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Stopwords Dictionary
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Built-in lightweight Chinese & English stopwords.
 */
export const DEFAULT_STOPWORDS: ReadonlySet<string> = new Set<string>([
  // Chinese high-frequency functional particles & pronouns
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
  '好', '自己', '这', '那', '与', '及', '其', '或', '把', '被', '让', '给',
  '但', '而', '又', '才', '更', '已', '此', '之', '自', '从', '向', '对',
  '将', '它', '他', '她', '么', '吗', '呢', '吧', '啊', '呀', '中',
  '我们', '你们', '他们', '她们', '它们', '这个', '那个', '这些', '那些',
  '因为', '所以', '以及', '并且', '而且', '或者', '如果', '虽然', '但是',
  '然而', '什么', '怎么', '怎样', '为什么', '如何', '一个', '这是', '是在',

  // English high-frequency stopwords
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'in', 'on', 'at', 'of',
  'for', 'with', 'by', 'to', 'from', 'it', 'its', 'that', 'this', 'these',
  'those', 'and', 'or', 'be', 'been', 'being', 'as', 'into', 'about',
  'than', 'then', 'so', 'such', 'not', 'no', 'nor', 'but', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'only', 'own',
  'same', 'too', 'very', 'can', 'will', 'just', 'should', 'now',
]);

// Single-character Chinese stopwords used to filter cross-stopword bi-grams
const SINGLE_CHAR_CHINESE_STOPWORDS: ReadonlySet<string> = new Set<string>([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个',
  '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '看', '好', '这',
  '那', '与', '及', '其', '或', '把', '被', '让', '给', '但', '而', '又', '才',
  '更', '已', '此', '之', '自', '从', '向', '对', '将', '它', '他', '她', '么',
  '中', '没', '己',
]);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

// Combined segment scanner
const SEGMENT_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]+|[a-zA-Z0-9_-]+/g;

const CJK_CHAR_REGEX = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

/**
 * Tokenize arbitrary text into searchable terms.
 * Supports:
 *   - Lowercased alphanumeric terms ([a-z0-9_-]+), filtering pure symbols & single chars.
 *   - CJK Bi-gram tokenization with unigram fallback for single chars.
 *   - Bilingual stopword elimination.
 */
export function tokenize(text: string, options?: TokenizeOptions): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const removeStopwords = options?.removeStopwords ?? true;
  const cjkBiGram = options?.cjkBiGram ?? true;
  const cjkUnigramFallback = options?.cjkUnigramFallback ?? true;
  const minAlphaNumLength = options?.minAlphaNumLength ?? 2;

  // Build combined stopword set
  let stopwords = DEFAULT_STOPWORDS;
  if (options?.customStopwords) {
    const custom = Array.isArray(options.customStopwords)
      ? options.customStopwords
      : Array.from(options.customStopwords);
    const merged = new Set(DEFAULT_STOPWORDS);
    for (const w of custom) {
      merged.add(w.toLowerCase().trim());
    }
    stopwords = merged;
  }

  const tokens: string[] = [];
  const matches = text.match(SEGMENT_REGEX);
  if (!matches) {
    return [];
  }

  const isStopChar = (char: string): boolean => {
    return SINGLE_CHAR_CHINESE_STOPWORDS.has(char) || stopwords.has(char);
  };

  const processCjkRun = (run: string) => {
    const len = run.length;
    if (len === 0) return;

    if (!cjkBiGram) {
      for (let i = 0; i < len; i++) {
        const char = run[i]!;
        if (!removeStopwords || !stopwords.has(char)) {
          tokens.push(char);
        }
      }
    } else if (len >= 2) {
      for (let i = 0; i < len - 1; i++) {
        const biGram = run.slice(i, i + 2);
        if (!removeStopwords || !stopwords.has(biGram)) {
          tokens.push(biGram);
        }
      }
    } else if (len === 1 && cjkUnigramFallback) {
      const char = run;
      if (!removeStopwords || !stopwords.has(char)) {
        tokens.push(char);
      }
    }
  };

  for (const rawSegment of matches) {
    // Check if segment is CJK
    if (CJK_CHAR_REGEX.test(rawSegment)) {
      if (removeStopwords) {
        // Split contiguous CJK by stopword characters to avoid noise bi-grams
        let currentRun = '';
        for (let i = 0; i < rawSegment.length; i++) {
          const char = rawSegment[i]!;
          if (isStopChar(char)) {
            if (currentRun.length > 0) {
              processCjkRun(currentRun);
              currentRun = '';
            }
          } else {
            currentRun += char;
          }
        }
        if (currentRun.length > 0) {
          processCjkRun(currentRun);
        }
      } else {
        processCjkRun(rawSegment);
      }
    } else {
      // English / Alphanumeric token
      const lower = rawSegment.toLowerCase();
      // Strip leading and trailing hyphens/underscores
      const cleaned = lower.replace(/^[-_]+|[-_]+$/g, '');

      // Filter: length check, must contain at least one alphanumeric character
      if (cleaned.length >= minAlphaNumLength && /[a-z0-9]/.test(cleaned)) {
        if (!removeStopwords || !stopwords.has(cleaned)) {
          tokens.push(cleaned);
        }
      }
    }
  }

  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. BM25 Inverted Index Engine
// ─────────────────────────────────────────────────────────────────────────────

export class BM25Index<T = unknown> {
  private readonly k1: number;
  private readonly b: number;
  private readonly tokenizeOptions?: TokenizeOptions;

  /** Stored document records: docId -> record */
  private documents: Map<string, BM25DocumentRecord<T>> = new Map();

  /** Inverted index: term -> Map<docId, termFrequency> */
  private invertedIndex: Map<string, Map<string, number>> = new Map();

  /** Document lengths: docId -> length */
  private docLengths: Map<string, number> = new Map();

  /** Total token length of all indexed documents */
  private totalDocLength = 0;

  constructor(options?: BM25Options) {
    this.k1 = options?.k1 ?? 1.5;
    this.b = options?.b ?? 0.75;
    this.tokenizeOptions = options?.tokenizeOptions;
  }

  /**
   * Total number of indexed documents.
   */
  get documentCount(): number {
    return this.documents.size;
  }

  /**
   * Total token count across all indexed documents.
   */
  get totalTokens(): number {
    return this.totalDocLength;
  }

  /**
   * Average document length (tokens per document).
   */
  get avgDocLength(): number {
    return this.documents.size > 0 ? this.totalDocLength / this.documents.size : 0;
  }

  /**
   * Add a single document to the index.
   * If a document with the same id exists, it will be replaced.
   */
  addDocument(id: string, text: string, metadata?: T): void {
    if (!id || typeof id !== 'string') {
      throw new Error('[BM25Index] Document id must be a non-empty string');
    }

    // If document already exists, remove it first to keep statistics consistent
    if (this.documents.has(id)) {
      this.removeDocument(id);
    }

    const tokens = tokenize(text, this.tokenizeOptions);
    const docLength = tokens.length;

    // Calculate term frequencies
    const tfMap = new Map<string, number>();
    for (const term of tokens) {
      tfMap.set(term, (tfMap.get(term) ?? 0) + 1);
    }

    // Add to inverted index
    for (const [term, freq] of tfMap.entries()) {
      let postings = this.invertedIndex.get(term);
      if (!postings) {
        postings = new Map<string, number>();
        this.invertedIndex.set(term, postings);
      }
      postings.set(id, freq);
    }

    // Update document statistics
    this.documents.set(id, {
      id,
      text,
      tokens,
      termFrequencies: tfMap,
      length: docLength,
      metadata,
    });
    this.docLengths.set(id, docLength);
    this.totalDocLength += docLength;
  }

  /**
   * Batch add documents to the index.
   */
  addDocuments(docs: Array<{ id: string; text: string; metadata?: T }>): void {
    for (const doc of docs) {
      this.addDocument(doc.id, doc.text, doc.metadata);
    }
  }

  /**
   * Remove a document from the index by ID.
   * Returns true if document was found and removed, false otherwise.
   */
  removeDocument(id: string): boolean {
    const existing = this.documents.get(id);
    if (!existing) {
      return false;
    }

    // Remove from inverted index
    for (const term of existing.termFrequencies.keys()) {
      const postings = this.invertedIndex.get(term);
      if (postings) {
        postings.delete(id);
        if (postings.size === 0) {
          this.invertedIndex.delete(term);
        }
      }
    }

    // Update statistics
    this.totalDocLength -= existing.length;
    this.docLengths.delete(id);
    this.documents.delete(id);

    return true;
  }

  /**
   * Clear all indexed documents, inverted tables, and statistics.
   */
  clear(): void {
    this.documents.clear();
    this.invertedIndex.clear();
    this.docLengths.clear();
    this.totalDocLength = 0;
  }

  /**
   * Calculate Robertson-Spärck Jones smoothed IDF for a given term.
   * Formula: ln(1 + (N - n(q) + 0.5) / (n(q) + 0.5))
   * Guaranteed to be strictly >= 0 for all 0 <= n(q) <= N.
   */
  calculateIDF(term: string): number {
    const N = this.documents.size;
    if (N === 0) return 0;

    const postings = this.invertedIndex.get(term);
    const n = postings ? postings.size : 0;
    if (n === 0) return 0;

    return Math.log(1 + (N - n + 0.5) / (n + 0.5));
  }

  /**
   * Search indexed documents matching the query using BM25 ranking.
   * Returns documents sorted by score descending, with min-max/max-score normalizedScore.
   */
  search(query: string, topK?: number): BM25SearchResult<T>[] {
    if (!query || typeof query !== 'string' || this.documents.size === 0) {
      return [];
    }

    const queryTokens = tokenize(query, this.tokenizeOptions);
    if (queryTokens.length === 0) {
      return [];
    }

    // Count query term frequencies
    const queryTf = new Map<string, number>();
    for (const t of queryTokens) {
      queryTf.set(t, (queryTf.get(t) ?? 0) + 1);
    }

    const N = this.documents.size;
    const avgdl = this.avgDocLength || 1;

    // Accumulate candidate scores
    const docScores = new Map<string, { score: number; matchedTerms: Set<string> }>();

    for (const [term, qtf] of queryTf.entries()) {
      const postings = this.invertedIndex.get(term);
      if (!postings || postings.size === 0) {
        continue;
      }

      // Robertson-Spärck Jones smoothed non-negative IDF
      const n_q = postings.size;
      const idf = Math.log(1 + (N - n_q + 0.5) / (n_q + 0.5));

      for (const [docId, tf] of postings.entries()) {
        const docLen = this.docLengths.get(docId) ?? 0;

        // Length normalization denominator
        const lenNorm = 1 - this.b + this.b * (docLen / avgdl);
        const denom = tf + this.k1 * lenNorm;
        const termScore = denom > 0 ? idf * ((tf * (this.k1 + 1)) / denom) * qtf : 0;

        let candidate = docScores.get(docId);
        if (!candidate) {
          candidate = { score: 0, matchedTerms: new Set<string>() };
          docScores.set(docId, candidate);
        }
        candidate.score += termScore;
        candidate.matchedTerms.add(term);
      }
    }

    if (docScores.size === 0) {
      return [];
    }

    // Convert candidates to list and sort descending by score
    const candidates = Array.from(docScores.entries()).map(([id, entry]) => ({
      id,
      score: entry.score,
      matchedTerms: Array.from(entry.matchedTerms),
      metadata: this.documents.get(id)?.metadata,
    }));

    candidates.sort((a, b) => b.score - a.score);

    // Compute normalized score in [0, 1] relative to top result
    const maxScore = candidates[0]?.score ?? 0;

    const results: BM25SearchResult<T>[] = candidates.map((item) => {
      const normalizedScore = maxScore > 0 ? Number((item.score / maxScore).toFixed(6)) : 0;
      return {
        id: item.id,
        score: Number(item.score.toFixed(6)),
        normalizedScore,
        matchedTerms: item.matchedTerms,
        metadata: item.metadata,
      };
    });

    if (topK !== undefined && topK > 0) {
      return results.slice(0, topK);
    }

    return results;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Reciprocal Rank Fusion (RRF)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reciprocal Rank Fusion (RRF).
 * Combines ranked lists from multiple search channels (e.g. BM25 + Vector Search)
 * using the formula: Score(d) = sum_m ( w_m / (k + rank_m(d)) )
 *
 * @param rankedLists Array of ranked lists from different channels.
 * @param options Configuration options including smoothing constant k (default 60).
 */
export function reciprocalRankFusion<T = unknown>(
  rankedLists: Array<{
    name?: string;
    items: Array<{ id: string; score?: number; item: T }>;
    weight?: number;
  }>,
  options?: RRFOptions
): RRFScoredItem<T>[] {
  const k = options?.k ?? 60;
  if (!rankedLists || rankedLists.length === 0) {
    return [];
  }

  const mergedMap = new Map<
    string,
    {
      id: string;
      score: number;
      item: T;
      channelDetails: RRFChannelDetail[];
    }
  >();

  for (let m = 0; m < rankedLists.length; m++) {
    const list = rankedLists[m];
    if (!list || !Array.isArray(list.items)) continue;

    const weight = typeof list.weight === 'number' && !isNaN(list.weight) ? list.weight : 1.0;
    const channelName = list.name ?? `channel_${m}`;

    // Deduplicate items within the same channel to protect against multiple occurrences
    const seenInChannel = new Set<string>();

    for (let i = 0; i < list.items.length; i++) {
      const entry = list.items[i];
      if (!entry || !entry.id) continue;
      if (seenInChannel.has(entry.id)) continue;
      seenInChannel.add(entry.id);

      const rank = i + 1; // 1-based rank
      const rrfScore = weight / (k + rank);

      let record = mergedMap.get(entry.id);
      if (!record) {
        record = {
          id: entry.id,
          score: 0,
          item: entry.item,
          channelDetails: [],
        };
        mergedMap.set(entry.id, record);
      }

      record.score += rrfScore;
      record.channelDetails.push({
        channelIndex: m,
        channelName,
        rank,
        rawScore: entry.score,
        rrfScore: Number(rrfScore.toFixed(8)),
      });
    }
  }

  const results = Array.from(mergedMap.values());
  results.sort((a, b) => b.score - a.score);

  return results.map((r) => ({
    id: r.id,
    score: Number(r.score.toFixed(8)),
    item: r.item,
    channelDetails: r.channelDetails,
  }));
}
