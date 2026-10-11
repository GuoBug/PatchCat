/**
 * @file    src/services/search/flat-vector-index.ts
 * @version 1.0.0
 * @description
 *   High-performance in-memory linear vector index using a single contiguous Float32Array buffer.
 *   Optimized for client-side RAG knowledge bases (1,000 ~ 5,000 chunks).
 *   Assumes vectors are L2 pre-normalized (||v|| = 1.0), reducing cosine similarity to dot product.
 *   Conforms to PRD-019 §4.2 contract.
 */

export interface VectorSearchResult {
  chunkId: string;
  score: number; // Normalized cosine similarity in [0, 1]
}

/**
 * Normalizes a vector in-place or into a new Float32Array so that ||v|| = 1.0.
 */
export function l2Normalize(vector: Float32Array | number[]): Float32Array {
  const len = vector.length;
  const result = vector instanceof Float32Array ? new Float32Array(vector) : new Float32Array(vector);
  let sumSq = 0.0;
  for (let i = 0; i < len; i++) {
    const val = result[i] ?? 0;
    sumSq += val * val;
  }
  const norm = Math.sqrt(sumSq);
  if (norm > 1e-12) {
    const inv = 1.0 / norm;
    for (let i = 0; i < len; i++) {
      result[i] = (result[i] ?? 0) * inv;
    }
  }
  return result;
}

/**
 * Computes raw dot product between two equal-length Float32Arrays.
 */
export function dotProduct(a: Float32Array, b: Float32Array): number {
  const len = a.length;
  let dot = 0.0;
  for (let i = 0; i < len; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

/**
 * High-performance flat vector index.
 */
export class FlatVectorIndex {
  private dimension: number;
  private capacity: number;
  private vectors: Float32Array;
  private chunkIds: string[] = [];
  private idToIndex: Map<string, number> = new Map();

  constructor(dimension: number, initialCapacity = 256) {
    if (dimension <= 0 || !Number.isInteger(dimension)) {
      throw new Error(`[FlatVectorIndex] Invalid dimension: ${dimension}. Must be positive integer.`);
    }
    this.dimension = dimension;
    this.capacity = Math.max(initialCapacity, 16);
    this.vectors = new Float32Array(this.capacity * this.dimension);
  }

  public getDimension(): number {
    return this.dimension;
  }

  public size(): number {
    return this.chunkIds.length;
  }

  /**
   * Adds or updates a vector in the index.
   * Vector must have length equal to index dimension.
   */
  public add(chunkId: string, vector: Float32Array | number[]): void {
    if (!chunkId) {
      throw new Error('[FlatVectorIndex] chunkId cannot be empty');
    }
    if (vector.length !== this.dimension) {
      throw new Error(
        `[FlatVectorIndex] Dimension mismatch for chunk "${chunkId}": expected ${this.dimension}, got ${vector.length}`,
      );
    }

    const normVec = vector instanceof Float32Array ? vector : new Float32Array(vector);

    const existingIdx = this.idToIndex.get(chunkId);
    if (existingIdx !== undefined) {
      // In-place update existing slot
      this.vectors.set(normVec, existingIdx * this.dimension);
      return;
    }

    // Expand capacity if needed
    if (this.chunkIds.length >= this.capacity) {
      this.growCapacity();
    }

    const targetIdx = this.chunkIds.length;
    this.vectors.set(normVec, targetIdx * this.dimension);
    this.chunkIds.push(chunkId);
    this.idToIndex.set(chunkId, targetIdx);
  }

  /**
   * Adds a batch of chunks and vectors.
   */
  public addBatch(items: Array<{ chunkId: string; vector: Float32Array | number[] }>): void {
    for (const item of items) {
      this.add(item.chunkId, item.vector);
    }
  }

  /**
   * Removes a chunk from the index.
   * Uses swap-with-last compaction for O(1) removal without memory relocation overhead.
   */
  public remove(chunkId: string): boolean {
    const idx = this.idToIndex.get(chunkId);
    if (idx === undefined) {
      return false;
    }

    const lastIdx = this.chunkIds.length - 1;
    if (idx < lastIdx) {
      // Move last item into removed slot
      const lastChunkId = this.chunkIds[lastIdx];
      if (lastChunkId !== undefined) {
        const lastVec = this.vectors.subarray(lastIdx * this.dimension, (lastIdx + 1) * this.dimension);
        this.vectors.set(lastVec, idx * this.dimension);
        this.chunkIds[idx] = lastChunkId;
        this.idToIndex.set(lastChunkId, idx);
      }
    }

    this.chunkIds.pop();
    this.idToIndex.delete(chunkId);
    return true;
  }

  /**
   * Retrieves the vector for a chunk if present.
   */
  public get(chunkId: string): Float32Array | null {
    const idx = this.idToIndex.get(chunkId);
    if (idx === undefined) {
      return null;
    }
    return new Float32Array(
      this.vectors.subarray(idx * this.dimension, (idx + 1) * this.dimension),
    );
  }

  /**
   * Searches top-K nearest neighbors using linear dot product scanning.
   * Assumes queryVec is L2 normalized. Clamps negative dot products to 0.0.
   */
  public search(
    queryVec: Float32Array | number[],
    topK = 10,
    minScore = 0.0,
  ): VectorSearchResult[] {
    if (queryVec.length !== this.dimension) {
      throw new Error(
        `[FlatVectorIndex] Query dimension mismatch: expected ${this.dimension}, got ${queryVec.length}`,
      );
    }
    const count = this.chunkIds.length;
    if (count === 0) {
      return [];
    }

    const q = queryVec instanceof Float32Array ? queryVec : new Float32Array(queryVec);
    const dim = this.dimension;
    const buf = this.vectors;
    const candidates: VectorSearchResult[] = [];

    for (let i = 0; i < count; i++) {
      let dot = 0.0;
      const offset = i * dim;
      for (let d = 0; d < dim; d++) {
        dot += (q[d] ?? 0) * (buf[offset + d] ?? 0);
      }

      // Clamp cosine similarity to [0, 1] as defined by PRD-019 §5.1
      const score = Math.max(0.0, Math.min(1.0, dot));
      const chunkId = this.chunkIds[i];
      if (score >= minScore && chunkId !== undefined) {
        candidates.push({
          chunkId,
          score: parseFloat(score.toFixed(4)),
        });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, Math.max(1, topK));
  }

  /**
   * Clears all indexed vectors and resets mappings.
   */
  public clear(): void {
    this.chunkIds = [];
    this.idToIndex.clear();
  }

  private growCapacity(): void {
    const newCapacity = this.capacity * 2;
    const newVectors = new Float32Array(newCapacity * this.dimension);
    newVectors.set(this.vectors);
    this.vectors = newVectors;
    this.capacity = newCapacity;
  }
}
