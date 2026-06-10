/**
 * Minimal persistent vector store: cosine similarity over plain number arrays.
 *
 * Port of `backend/app/rag/store.py` (NumPy-backed). Embeddings are persisted
 * as JSON (`embeddings.json`) instead of NumPy's `.npy` format, so the index
 * must be rebuilt with `npm run ingest` (the knowledge markdown sources are
 * the ground truth). Intentionally simple and dependency-light: a good fit
 * for an MVP-sized knowledge base (hundreds of chunks).
 */

import fs from "node:fs";
import path from "node:path";

const EMBEDDINGS_FILE = "embeddings.json";
const DOCUMENTS_FILE = "documents.json";

/** A retrievable knowledge chunk. */
export interface Document {
  id: string;
  text: string;
  source: string;
}

/** A document plus its similarity score for a query. */
export interface SearchHit {
  document: Document;
  score: number;
}

interface DocumentsPayload {
  model: string;
  dim: number;
  documents: Document[];
}

/** In-memory cosine-similarity store with disk persistence. */
export class VectorStore {
  readonly dim: number;
  readonly model: string;
  private documents: Document[] = [];
  private matrix: number[][] = [];

  constructor(dim: number, model: string) {
    this.dim = dim;
    this.model = model;
  }

  get size(): number {
    return this.documents.length;
  }

  add(documents: Document[], embeddings: number[][]): void {
    if (documents.length === 0) {
      return;
    }
    if (documents.length !== embeddings.length) {
      throw new Error(
        `documents/embeddings length mismatch: ${documents.length} vs ${embeddings.length}`,
      );
    }
    const vectors = embeddings.map((vector) => {
      if (vector.length !== this.dim) {
        throw new Error(`embedding dim ${vector.length} does not match store dim ${this.dim}`);
      }
      return normalize(vector);
    });
    this.documents.push(...documents);
    this.matrix.push(...vectors);
  }

  search(queryEmbedding: number[], topK: number): SearchHit[] {
    if (this.documents.length === 0) {
      return [];
    }
    const query = normalize(queryEmbedding);
    const scored = this.matrix.map((row, index) => ({
      index,
      score: dot(row, query), // cosine similarity (rows are normalized)
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored
      .slice(0, topK)
      .map(({ index, score }) => ({ document: this.documents[index], score }));
  }

  save(indexDir: string): void {
    fs.mkdirSync(indexDir, { recursive: true });
    fs.writeFileSync(path.join(indexDir, EMBEDDINGS_FILE), JSON.stringify(this.matrix), "utf-8");
    const payload: DocumentsPayload = {
      model: this.model,
      dim: this.dim,
      documents: this.documents,
    };
    fs.writeFileSync(
      path.join(indexDir, DOCUMENTS_FILE),
      JSON.stringify(payload, null, 2),
      "utf-8",
    );
  }

  static load(indexDir: string): VectorStore {
    const meta = JSON.parse(
      fs.readFileSync(path.join(indexDir, DOCUMENTS_FILE), "utf-8"),
    ) as DocumentsPayload;
    const store = new VectorStore(Number(meta.dim), String(meta.model));
    store.documents = meta.documents.map((doc) => ({
      id: doc.id,
      text: doc.text,
      source: doc.source,
    }));
    store.matrix = JSON.parse(
      fs.readFileSync(path.join(indexDir, EMBEDDINGS_FILE), "utf-8"),
    ) as number[][];
    return store;
  }
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

function normalize(vector: number[]): number[] {
  let norm = Math.sqrt(dot(vector, vector));
  if (norm === 0) {
    norm = 1.0;
  }
  return vector.map((value) => value / norm);
}
