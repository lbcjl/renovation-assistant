/**
 * Tests for the JSON-persisted vector store.
 *
 * Ports `backend/tests/test_store.py`.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { VectorStore, type Document } from "@/lib/rag/store";

function buildStore(): VectorStore {
  const store = new VectorStore(3, "test");
  const documents: Document[] = [
    { id: "a", text: "a", source: "A" },
    { id: "b", text: "b", source: "B" },
  ];
  store.add(documents, [
    [1.0, 0.0, 0.0],
    [0.0, 1.0, 0.0],
  ]);
  return store;
}

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vector-store-test-"));
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe("VectorStore.search", () => {
  it("returns the most similar document first (cosine ranking)", () => {
    const hits = buildStore().search([0.9, 0.1, 0.0], 2);
    expect(hits[0].document.id).toBe("a");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("returns empty for an empty store", () => {
    const store = new VectorStore(3, "test");
    expect(store.search([1.0, 0.0, 0.0], 5)).toEqual([]);
  });

  it("caps results at topK", () => {
    const hits = buildStore().search([0.5, 0.5, 0.0], 1);
    expect(hits).toHaveLength(1);
  });

  it("normalizes vectors so scale does not change ranking", () => {
    const store = new VectorStore(2, "test");
    store.add(
      [
        { id: "long", text: "long", source: "L" },
        { id: "short", text: "short", source: "S" },
      ],
      [
        [100.0, 0.0],
        [0.0, 0.1],
      ],
    );
    const hits = store.search([0.0, 5.0], 2);
    expect(hits[0].document.id).toBe("short");
    expect(hits[0].score).toBeCloseTo(1.0, 5);
  });
});

describe("VectorStore persistence", () => {
  it("save/load roundtrip preserves documents, metadata, and ranking", () => {
    buildStore().save(tempDir);

    const loaded = VectorStore.load(tempDir);
    expect(loaded.size).toBe(2);
    expect(loaded.model).toBe("test");
    expect(loaded.dim).toBe(3);
    expect(loaded.search([1.0, 0.0, 0.0], 1)[0].document.id).toBe("a");
  });

  it("persists embeddings as plain JSON number arrays", () => {
    buildStore().save(tempDir);

    const matrix = JSON.parse(
      fs.readFileSync(path.join(tempDir, "embeddings.json"), "utf-8"),
    ) as number[][];
    expect(matrix).toHaveLength(2);
    expect(matrix[0]).toHaveLength(3);
    expect(matrix.every((row) => row.every((value) => typeof value === "number"))).toBe(true);
  });
});
