/**
 * Embedding provider for an OpenAI-compatible /embeddings API.
 *
 * Port of `backend/app/rag/embeddings.py`. Uses `fetch` directly instead of
 * the OpenAI SDK: POST {baseUrl}/embeddings with a bearer key. Defaults
 * target SiliconFlow hosting BAAI/bge-m3 (strong Chinese retrieval), so no
 * local embedding model is required.
 */

// Max texts per embeddings request. DashScope text-embedding caps this at 10;
// batching keeps us within provider limits regardless of corpus size.
const BATCH_SIZE = 10;

/** Interface for turning text into vectors. */
export interface EmbeddingProvider {
  /** Embed a batch of documents. */
  embed(texts: string[]): Promise<number[][]>;
  /** Embed a single query string. */
  embedQuery(text: string): Promise<number[]>;
}

interface EmbeddingsResponseItem {
  index: number;
  embedding: number[];
}

function parseEmbeddingsResponse(payload: unknown): EmbeddingsResponseItem[] {
  if (typeof payload !== "object" || payload === null || !("data" in payload)) {
    throw new Error("Unexpected embeddings response: missing `data`");
  }
  const data = (payload as { data: unknown }).data;
  if (!Array.isArray(data)) {
    throw new Error("Unexpected embeddings response: `data` is not an array");
  }
  return data.map((item: unknown) => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as { index?: unknown }).index !== "number" ||
      !Array.isArray((item as { embedding?: unknown }).embedding)
    ) {
      throw new Error("Unexpected embeddings response item shape");
    }
    const { index, embedding } = item as { index: number; embedding: unknown[] };
    if (!embedding.every((value): value is number => typeof value === "number")) {
      throw new Error("Unexpected embeddings response: non-numeric embedding values");
    }
    return { index, embedding };
  });
}

/**
 * Call an OpenAI-compatible /embeddings endpoint.
 *
 * The provider can be constructed without credentials (e.g. when no knowledge
 * index exists yet and embeddings are never actually called). A missing key
 * only fails when an embedding call is made.
 */
export class OpenAICompatibleEmbeddings implements EmbeddingProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly model: string;

  constructor(options: { apiKey: string; baseUrl: string; model: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.model = options.model;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const vectors: number[][] = [];
    for (let start = 0; start < texts.length; start += BATCH_SIZE) {
      const batch = texts.slice(start, start + BATCH_SIZE);
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model, input: batch }),
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(
          `Embeddings request failed with status ${response.status}: ${detail.slice(0, 500)}`,
        );
      }
      const payload: unknown = await response.json();
      // The API may reorder; sort by index within the batch to be safe.
      const ordered = parseEmbeddingsResponse(payload).sort((a, b) => a.index - b.index);
      vectors.push(...ordered.map((item) => item.embedding));
    }
    return vectors;
  }

  async embedQuery(text: string): Promise<number[]> {
    const vectors = await this.embed([text]);
    return vectors[0];
  }
}
