/**
 * Application settings loaded from environment variables.
 *
 * Port of `backend/app/config.py` (pydantic-settings) with the same defaults.
 * Next.js loads `.env.local` / `.env` into `process.env` automatically; the
 * standalone ingest script loads them itself (see `scripts/ingest.ts`).
 *
 * Auth (JWT) and database settings were intentionally dropped: login is
 * cancelled in the Next.js migration.
 */

import path from "node:path";

export interface Settings {
  // --- LLM provider (OpenAI-compatible). Defaults target DeepSeek. ---
  llmApiKey: string;
  llmBaseUrl: string;
  llmModel: string;

  /** Request timeout (seconds) applied to LLM chat calls. */
  requestTimeoutSeconds: number;

  // --- Image generation provider (OpenAI-compatible). ---
  imageApiKey: string;
  imageBaseUrl: string;
  imageModel: string;
  imageProxyUrl: string;

  // --- Embedding provider (OpenAI-compatible /embeddings). ---
  embeddingApiKey: string;
  embeddingBaseUrl: string;
  embeddingModel: string;

  // --- Retrieval (RAG) ---
  retrievalTopK: number;
  retrievalMinScore: number;

  // --- Paths (absolute, resolved from the repo root / process.cwd()) ---
  knowledgeDir: string;
  indexDir: string;
  uploadsDir: string;
  providerConfigPath: string;
  fileMetadataPath: string;
}

function envString(name: string, fallback: string): string {
  const value = process.env[name];
  return value !== undefined && value !== "" ? value : fallback;
}

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildSettings(): Settings {
  const root = process.cwd();
  return {
    llmApiKey: envString("LLM_API_KEY", ""),
    llmBaseUrl: envString("LLM_BASE_URL", "https://api.deepseek.com"),
    llmModel: envString("LLM_MODEL", "deepseek-chat"),

    requestTimeoutSeconds: envNumber("REQUEST_TIMEOUT_SECONDS", 60.0),

    imageApiKey: envString("IMAGE_API_KEY", ""),
    imageBaseUrl: envString("IMAGE_BASE_URL", "https://freeapi.dgbmc.top/v1"),
    imageModel: envString("IMAGE_MODEL", "gpt-image-2"),
    imageProxyUrl: envString("IMAGE_PROXY_URL", ""),

    embeddingApiKey: envString("EMBEDDING_API_KEY", ""),
    embeddingBaseUrl: envString("EMBEDDING_BASE_URL", "https://api.siliconflow.cn/v1"),
    embeddingModel: envString("EMBEDDING_MODEL", "BAAI/bge-m3"),

    retrievalTopK: envNumber("RETRIEVAL_TOP_K", 4),
    retrievalMinScore: envNumber("RETRIEVAL_MIN_SCORE", 0.5),

    // Paths default to the repo's data/ directory; the env overrides exist so
    // tests can redirect all disk access to temp directories.
    knowledgeDir: envString("KNOWLEDGE_DIR", path.join(root, "data", "knowledge")),
    indexDir: envString("INDEX_DIR", path.join(root, "data", "index")),
    uploadsDir: envString("UPLOADS_DIR", path.join(root, "data", "uploads")),
    providerConfigPath: envString(
      "PROVIDER_CONFIG_PATH",
      path.join(root, "data", "provider_config.json"),
    ),
    fileMetadataPath: envString(
      "FILE_METADATA_PATH",
      path.join(root, "data", "file_metadata.json"),
    ),
  };
}

/**
 * Per-process singleton cache via `globalThis`: Next.js dev hot-reload
 * re-executes modules, so a module-level variable would be reset on every
 * recompile while `globalThis` survives.
 */
const globalCache = globalThis as typeof globalThis & {
  __renovationSettings?: Settings;
};

/** Return a cached Settings instance (equivalent of Python's `get_settings`). */
export function getSettings(): Settings {
  if (globalCache.__renovationSettings === undefined) {
    globalCache.__renovationSettings = buildSettings();
  }
  return globalCache.__renovationSettings;
}

/**
 * Drop the cached Settings so the next `getSettings()` re-reads `process.env`.
 * Intended for tests that change path/provider environment variables.
 */
export function resetSettingsCache(): void {
  delete globalCache.__renovationSettings;
}
