/**
 * Build the vector index from markdown docs in the knowledge directory.
 *
 * Port of `backend/app/rag/ingest.py`.
 *
 * Usage (from the repo root, with EMBEDDING_API_KEY set in .env.local):
 *
 *     npm run ingest
 *
 * Walks `data/knowledge/**` recursively for `.md` files, chunks them, embeds
 * the chunks via the OpenAI-compatible /embeddings endpoint, and saves the
 * index (documents.json + embeddings.json) to `data/index/`.
 */

import fs from "node:fs";
import path from "node:path";

import { getSettings } from "@/lib/config";
import { chunkMarkdown } from "@/lib/rag/chunking";
import { OpenAICompatibleEmbeddings } from "@/lib/rag/embeddings";
import { VectorStore, type Document } from "@/lib/rag/store";

/**
 * Load KEY=VALUE pairs from .env.local / .env into process.env.
 *
 * Next.js does this automatically for the server, but this standalone script
 * runs under tsx, so it loads the files itself. Existing environment
 * variables are never overridden.
 */
function loadEnvFiles(root: string): void {
  for (const name of [".env.local", ".env"]) {
    const filePath = path.join(root, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    const content = fs.readFileSync(filePath, "utf-8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separator = line.indexOf("=");
      if (separator <= 0) {
        continue;
      }
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

/** Recursively collect all .md files under a directory, sorted by path. */
function findMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results.sort();
}

async function buildIndex(): Promise<VectorStore> {
  loadEnvFiles(process.cwd());
  const settings = getSettings();

  const docPaths = findMarkdownFiles(settings.knowledgeDir);
  if (docPaths.length === 0) {
    throw new Error(`No .md files found in ${settings.knowledgeDir}`);
  }
  if (!settings.embeddingApiKey) {
    throw new Error("EMBEDDING_API_KEY is not set; cannot build the index.");
  }

  const documents: Document[] = [];
  for (const docPath of docPaths) {
    const text = fs.readFileSync(docPath, "utf-8");
    const stem = path.basename(docPath, ".md");
    chunkMarkdown(text, stem).forEach(([chunk, source], i) => {
      documents.push({ id: `${stem}-${i}`, text: chunk, source });
    });
  }

  const embeddings = new OpenAICompatibleEmbeddings({
    apiKey: settings.embeddingApiKey,
    baseUrl: settings.embeddingBaseUrl,
    model: settings.embeddingModel,
  });
  const vectors = await embeddings.embed(documents.map((doc) => doc.text));

  const store = new VectorStore(vectors[0].length, settings.embeddingModel);
  store.add(documents, vectors);
  store.save(settings.indexDir);
  console.log(
    `Indexed ${store.size} chunks from ${docPaths.length} docs -> ${settings.indexDir}`,
  );
  return store;
}

buildIndex().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
