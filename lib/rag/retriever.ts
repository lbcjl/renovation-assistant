/**
 * Retrieve relevant knowledge chunks for a user query.
 *
 * Port of `backend/app/rag/retriever.py`.
 */

import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import type { SearchHit, VectorStore } from "@/lib/rag/store";

/** Result of a retrieval: the relevant hits (may be empty). */
export interface RetrievedContext {
  hits: SearchHit[];
}

export function isEmptyContext(context: RetrievedContext): boolean {
  return context.hits.length === 0;
}

/** Embed a query, search the store, and keep hits above a score threshold. */
export class Retriever {
  private readonly _store: VectorStore;
  private readonly embeddings: EmbeddingProvider;
  private readonly topK: number;
  private readonly minScore: number;

  constructor(
    store: VectorStore,
    embeddings: EmbeddingProvider,
    options: { topK: number; minScore: number },
  ) {
    this._store = store;
    this.embeddings = embeddings;
    this.topK = options.topK;
    this.minScore = options.minScore;
  }

  /** Access the underlying vector store for direct operations. */
  get store(): VectorStore {
    return this._store;
  }

  async retrieve(query: string): Promise<RetrievedContext> {
    // No index yet -> behave gracefully (no embedding call, empty context).
    if (this._store.size === 0 || !query.trim()) {
      return { hits: [] };
    }
    const queryVector = await this.embeddings.embedQuery(query);
    const hits = this._store.search(queryVector, this.topK);
    const relevant = hits.filter((hit) => hit.score >= this.minScore);
    return { hits: relevant };
  }
}
