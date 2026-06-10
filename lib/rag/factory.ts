/**
 * Construct the embedding provider and retriever from configuration.
 *
 * Port of `backend/app/rag/factory.py` (`@lru_cache` becomes a `globalThis`
 * cache so the instances survive Next.js dev hot reloads). The vector store
 * is shared between the chat route (retrieval) and the files add-to-kb route
 * (ingestion), so documents added at runtime are immediately retrievable.
 */

import fs from "node:fs";
import path from "node:path";

import { getSettings } from "@/lib/config";
import { OpenAICompatibleEmbeddings, type EmbeddingProvider } from "@/lib/rag/embeddings";
import { Retriever } from "@/lib/rag/retriever";
import { VectorStore } from "@/lib/rag/store";

const DOCUMENTS_FILE = "documents.json";

const globalCache = globalThis as typeof globalThis & {
  __renovationEmbeddings?: EmbeddingProvider;
  __renovationRetriever?: Retriever;
};

export function getEmbeddings(): EmbeddingProvider {
  if (globalCache.__renovationEmbeddings === undefined) {
    const settings = getSettings();
    globalCache.__renovationEmbeddings = new OpenAICompatibleEmbeddings({
      apiKey: settings.embeddingApiKey,
      baseUrl: settings.embeddingBaseUrl,
      model: settings.embeddingModel,
    });
  }
  return globalCache.__renovationEmbeddings;
}

function loadStore(): VectorStore {
  const settings = getSettings();
  if (fs.existsSync(path.join(settings.indexDir, DOCUMENTS_FILE))) {
    try {
      return VectorStore.load(settings.indexDir);
    } catch (error) {
      console.warn(`Ignoring unreadable vector index in ${settings.indexDir}:`, error);
    }
  }
  // No index built yet: an empty store makes chat degrade gracefully to
  // plain LLM answers (with honest "no knowledge base" hedging).
  return new VectorStore(1, settings.embeddingModel);
}

export function getRetriever(): Retriever {
  if (globalCache.__renovationRetriever === undefined) {
    const settings = getSettings();
    globalCache.__renovationRetriever = new Retriever(loadStore(), getEmbeddings(), {
      topK: settings.retrievalTopK,
      minScore: settings.retrievalMinScore,
    });
  }
  return globalCache.__renovationRetriever;
}

/**
 * Swap the vector store backing the shared retriever singleton.
 *
 * Used by add-to-kb when the placeholder empty store (created before any
 * index existed) must be replaced with one matching the real embedding
 * dimension; chat retrieval picks up the new store on the next request.
 */
export function replaceVectorStore(store: VectorStore): VectorStore {
  const settings = getSettings();
  globalCache.__renovationRetriever = new Retriever(store, getEmbeddings(), {
    topK: settings.retrievalTopK,
    minScore: settings.retrievalMinScore,
  });
  return store;
}

/** Drop the cached instances (tests, or after settings changes). */
export function resetRagSingletons(): void {
  delete globalCache.__renovationEmbeddings;
  delete globalCache.__renovationRetriever;
}
