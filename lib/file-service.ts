/**
 * File management service: upload, list, delete, metadata storage, add-to-kb.
 *
 * Port of `backend/app/services/file_service.py`. Metadata field names stay
 * snake_case so the JSON written by the FastAPI backend keeps working. The
 * `path` field is the URL the UI uses to fetch the stored bytes; it now
 * points at `/api/files/{id}/content` (replacing the old static mount at
 * `/backend/data/uploads/...`).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { extractFileContent, UnsupportedFileTypeError } from "@/lib/file-processor";
import { chunkMarkdown } from "@/lib/rag/chunking";
import type { EmbeddingProvider } from "@/lib/rag/embeddings";
import { VectorStore, type Document } from "@/lib/rag/store";

/** Metadata for an uploaded file (snake_case mirrors the Python schema). */
export interface FileMetadata {
  id: string;
  filename: string;
  original_name: string;
  type: string;
  size: number;
  path: string;
  uploaded_at: string;
  in_knowledge_base: boolean;
  user_id: string;
}

/** Client-side validation failure (Python `ValueError`; maps to HTTP 400). */
export class FileValidationError extends Error {}

// File size limits in bytes.
export const FILE_SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10MB
  document: 20 * 1024 * 1024, // 20MB
  table: 10 * 1024 * 1024, // 10MB
};

// Allowed file types. txt/md are additions over the Python service (the
// migration spec calls for utf-8 text ingestion).
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "text/markdown",
]);

export const ALLOWED_EXTENSIONS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".pdf",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
  ".md",
]);

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }
  if (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "text/csv"
  ) {
    return "table";
  }
  return "document"; // default
}

/** Access to the shared vector store (lets add-to-kb swap a placeholder store). */
export interface VectorStoreAccess {
  getStore(): VectorStore;
  replaceStore(store: VectorStore): VectorStore;
}

export interface AddToKnowledgeBaseDeps {
  embeddings: EmbeddingProvider;
  stores: VectorStoreAccess;
  indexDir: string;
}

interface MetadataFile {
  files: Array<Record<string, unknown>>;
}

function toMetadata(data: Record<string, unknown>): FileMetadata {
  return {
    id: String(data["id"] ?? ""),
    filename: String(data["filename"] ?? ""),
    original_name: String(data["original_name"] ?? ""),
    type: String(data["type"] ?? ""),
    size: Number(data["size"] ?? 0),
    path: String(data["path"] ?? ""),
    uploaded_at: String(data["uploaded_at"] ?? ""),
    in_knowledge_base: Boolean(data["in_knowledge_base"] ?? false),
    user_id: String(data["user_id"] ?? "default"),
  };
}

function utcTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `_${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`
  );
}

/** Manages file uploads and metadata persistence. */
export class FileService {
  private readonly uploadDir: string;
  private readonly metadataFile: string;

  constructor(uploadDir: string, metadataFile: string) {
    this.uploadDir = uploadDir;
    this.metadataFile = metadataFile;
    this.ensureDirectories();
  }

  private ensureDirectories(): void {
    fs.mkdirSync(this.uploadDir, { recursive: true });
    if (!fs.existsSync(this.metadataFile)) {
      this.saveMetadata({ files: [] });
    }
  }

  private loadMetadata(): MetadataFile {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(this.metadataFile, "utf-8"));
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        Array.isArray((parsed as MetadataFile).files)
      ) {
        return parsed as MetadataFile;
      }
    } catch {
      // Missing or corrupt metadata file -> start fresh (Python behavior).
    }
    return { files: [] };
  }

  private saveMetadata(data: MetadataFile): void {
    fs.mkdirSync(path.dirname(this.metadataFile), { recursive: true });
    fs.writeFileSync(this.metadataFile, JSON.stringify(data, null, 2), "utf-8");
  }

  /**
   * Validate file type and size.
   *
   * @throws FileValidationError If the file type or size is invalid.
   */
  validateFile(filename: string, contentType: string, size: number): void {
    // Prevent path traversal in filename.
    if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
      throw new FileValidationError("Filename cannot contain path separators or '..'");
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      const allowed = Array.from(ALLOWED_EXTENSIONS).sort().join(", ");
      throw new FileValidationError(`Unsupported file type: ${ext}. Allowed: ${allowed}`);
    }

    if (!ALLOWED_MIME_TYPES.has(contentType)) {
      throw new FileValidationError(`Unsupported MIME type: ${contentType}`);
    }

    const limit = FILE_SIZE_LIMITS[getFileCategory(contentType)];
    if (size > limit) {
      const limitMb = limit / (1024 * 1024);
      throw new FileValidationError(`File too large: ${size} bytes exceeds ${limitMb}MB limit`);
    }
  }

  /**
   * Save an uploaded file and create its metadata entry.
   *
   * @throws FileValidationError If file validation fails.
   */
  async saveFile(options: {
    filename: string;
    content: Buffer;
    contentType: string;
    userId?: string;
  }): Promise<FileMetadata> {
    const { filename, content, contentType } = options;
    const userId = options.userId ?? "default";
    this.validateFile(filename, contentType, content.length);

    const fileId = crypto.randomUUID();
    const ext = path.extname(filename);
    const uniqueFilename = `${utcTimestamp(new Date())}_${fileId}${ext}`;
    await fs.promises.writeFile(path.join(this.uploadDir, uniqueFilename), content);

    const metadata: FileMetadata = {
      id: fileId,
      filename: uniqueFilename,
      original_name: filename,
      type: contentType,
      size: content.length,
      path: `/api/files/${fileId}/content`,
      uploaded_at: new Date().toISOString(),
      in_knowledge_base: false,
      user_id: userId,
    };

    const data = this.loadMetadata();
    data.files.push({ ...metadata });
    this.saveMetadata(data);
    return metadata;
  }

  listFiles(userId = "default"): FileMetadata[] {
    return this.loadMetadata()
      .files.filter((file) => (file["user_id"] ?? "default") === userId)
      .map(toMetadata);
  }

  getFile(fileId: string, userId = "default"): FileMetadata | null {
    for (const file of this.loadMetadata().files) {
      if (file["id"] === fileId && (file["user_id"] ?? "default") === userId) {
        return toMetadata(file);
      }
    }
    return null;
  }

  /** Resolve a stored filename inside the upload dir, or null if unsafe. */
  resolveStoredPath(filename: string): string | null {
    try {
      const resolved = path.resolve(this.uploadDir, filename);
      const root = path.resolve(this.uploadDir);
      if (resolved !== root && !resolved.startsWith(root + path.sep)) {
        console.warn(`Path traversal attempt blocked: ${filename}`);
        return null;
      }
      return resolved;
    } catch {
      console.warn(`Invalid file path: ${filename}`);
      return null;
    }
  }

  deleteFile(fileId: string, userId = "default"): boolean {
    const data = this.loadMetadata();
    for (let index = 0; index < data.files.length; index += 1) {
      const file = data.files[index];
      if (file["id"] !== fileId || (file["user_id"] ?? "default") !== userId) {
        continue;
      }
      const filePath = this.resolveStoredPath(String(file["filename"] ?? ""));
      if (filePath === null) {
        return false;
      }
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      data.files.splice(index, 1);
      this.saveMetadata(data);
      return true;
    }
    return false;
  }

  markInKnowledgeBase(fileId: string, userId = "default"): boolean {
    const data = this.loadMetadata();
    for (const file of data.files) {
      if (file["id"] === fileId && (file["user_id"] ?? "default") === userId) {
        file["in_knowledge_base"] = true;
        this.saveMetadata(data);
        return true;
      }
    }
    return false;
  }

  /**
   * Extract file content, chunk, embed, and add to the RAG knowledge base.
   *
   * Returns `[success, message]` like the Python service; all failures are
   * caught and reported as messages (the route maps them to HTTP statuses).
   */
  async addToKnowledgeBase(
    fileId: string,
    userId: string,
    deps: AddToKnowledgeBaseDeps,
  ): Promise<[boolean, string]> {
    const fileMetadata = this.getFile(fileId, userId);
    if (!fileMetadata) {
      return [false, "File not found"];
    }
    if (fileMetadata.in_knowledge_base) {
      return [false, "File is already in knowledge base"];
    }

    const filePath = this.resolveStoredPath(fileMetadata.filename);
    if (filePath === null) {
      return [false, "Invalid file path"];
    }
    if (!fs.existsSync(filePath)) {
      console.warn(`Physical file not found: ${filePath}`);
      return [false, "Physical file not found"];
    }

    // Extract content.
    let content: string;
    try {
      content = await extractFileContent(filePath, fileMetadata.type);
    } catch (error) {
      if (error instanceof UnsupportedFileTypeError) {
        return [false, error.message];
      }
      console.error(`Content extraction failed for file ${fileId}:`, error);
      return [
        false,
        `Content extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }
    if (!content.trim()) {
      return [false, "No text content could be extracted from this file"];
    }

    // Chunk content (same chunking as the markdown knowledge docs).
    let chunks: ReturnType<typeof chunkMarkdown>;
    try {
      const formatted = `## ${fileMetadata.original_name}\n\n${content}`;
      chunks = chunkMarkdown(formatted, `file:${fileMetadata.original_name}`);
    } catch (error) {
      console.error(`Chunking failed for file ${fileId}:`, error);
      return [false, `Chunking failed: ${error instanceof Error ? error.message : String(error)}`];
    }
    if (chunks.length === 0) {
      return [false, "Content could not be split into chunks"];
    }

    // Generate embeddings.
    let vectors: number[][];
    try {
      vectors = await deps.embeddings.embed(chunks.map(([text]) => text));
    } catch (error) {
      console.error(`Embedding generation failed for file ${fileId}:`, error);
      return [
        false,
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }

    const documents: Document[] = chunks.map(([text, sourceLabel], index) => ({
      id: `file-${fileId}-${index}`,
      text,
      source: sourceLabel,
    }));

    // Add to the vector store and persist.
    try {
      let store = deps.stores.getStore();
      if (store.size === 0 && vectors.length > 0 && store.dim !== vectors[0].length) {
        // The placeholder store created before any index existed has the
        // wrong dimension; replace it with one matching the embeddings.
        store = deps.stores.replaceStore(new VectorStore(vectors[0].length, store.model));
      }
      store.add(documents, vectors);
      store.save(deps.indexDir);
    } catch (error) {
      console.error(`Vector store update failed for file ${fileId}:`, error);
      return [
        false,
        `Vector store update failed: ${error instanceof Error ? error.message : String(error)}`,
      ];
    }

    if (!this.markInKnowledgeBase(fileId, userId)) {
      return [false, "Failed to update file metadata"];
    }
    return [true, `Successfully added ${documents.length} chunks to knowledge base`];
  }
}
