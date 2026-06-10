/**
 * Browser-side helpers for calling the Next.js API routes.
 *
 * Port of `frontend/src/api/{files,image,settings}.ts` (axios replaced with
 * `fetch`) with the same friendly Chinese error messages. Components call
 * these helpers instead of using `fetch` directly.
 */

import type { FileMetadata } from "@/lib/file-service";

export type { FileMetadata };

/** Error payload shape returned by the API routes ({"detail": "..."}). */
interface ErrorResponse {
  detail?: unknown;
}

/** Extract the `detail` string from an error response body, if present. */
async function detailOf(response: Response): Promise<string | null> {
  try {
    const data = (await response.json()) as ErrorResponse;
    return typeof data.detail === "string" ? data.detail : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Files (port of frontend/src/api/files.ts)
// ---------------------------------------------------------------------------

export interface FileUploadResponse {
  file: FileMetadata;
}

export interface FileListResponse {
  files: FileMetadata[];
}

export interface AddToKnowledgeBaseResponse {
  success: boolean;
  message: string;
}

/** Upload a file to the server; resolves with the stored file's metadata. */
export async function uploadFile(file: File): Promise<FileMetadata> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/files/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 400) {
      const detail = await detailOf(response);
      throw new Error(detail ?? "文件上传失败");
    }
    throw new Error(`上传失败 (${response.status})`);
  }

  const data = (await response.json()) as FileUploadResponse;
  return data.file;
}

/** List all uploaded files. */
export async function listFiles(): Promise<FileMetadata[]> {
  const response = await fetch("/api/files", { method: "GET" });
  if (!response.ok) {
    throw new Error(`获取文件列表失败 (${response.status})`);
  }
  const data = (await response.json()) as FileListResponse;
  return data.files;
}

/** Delete an uploaded file. */
export async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`/api/files/${fileId}`, { method: "DELETE" });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("文件不存在");
    }
    throw new Error(`删除失败 (${response.status})`);
  }
}

/** Extract a file's text content and add it to the knowledge base. */
export async function addToKnowledgeBase(fileId: string): Promise<AddToKnowledgeBaseResponse> {
  const response = await fetch(`/api/files/${fileId}/add-to-kb`, { method: "POST" });
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("文件不存在");
    }
    throw new Error(`操作失败 (${response.status})`);
  }
  return (await response.json()) as AddToKnowledgeBaseResponse;
}

// ---------------------------------------------------------------------------
// Image generation (port of frontend/src/api/image.ts)
// ---------------------------------------------------------------------------

export interface ImageGenerationResponse {
  image_url: string;
}

function imageErrorMessage(status: number): string {
  if (status === 503) {
    return "图像生成服务暂时不可用，已自动重试仍失败，请稍后再试";
  }
  // The prompt guard returns 400 (FastAPI used 422); same friendly message.
  if (status === 400 || status === 422) {
    return "描述内容不符合要求：不能为空，且不超过 1000 字";
  }
  return "生成失败，请重试";
}

/** Generate a renovation rendering; resolves with the image URL. */
export async function generateImage(prompt: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
  } catch {
    throw new Error("无法连接服务器，请确认后端服务已启动");
  }
  if (!response.ok) {
    throw new Error(imageErrorMessage(response.status));
  }
  const data = (await response.json()) as ImageGenerationResponse;
  return data.image_url;
}

// ---------------------------------------------------------------------------
// Provider settings (port of frontend/src/api/settings.ts)
// ---------------------------------------------------------------------------

export type ProviderSection = "llm" | "image";

export interface ProviderSettings {
  base_url: string;
  model: string;
  api_key_set: boolean;
  api_key_preview: string;
}

export interface ModelListResponse {
  models: string[];
  default: string;
}

/** Fetch JSON, mapping network failures and error bodies to a friendly Error. */
async function requestJson<T>(url: string, init: RequestInit, fallback: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(fallback);
  }
  if (!response.ok) {
    const detail = await detailOf(response);
    throw new Error(detail ?? fallback);
  }
  return (await response.json()) as T;
}

/** Current connection settings for a provider (API key is masked). */
export async function fetchProviderSettings(provider: ProviderSection): Promise<ProviderSettings> {
  return requestJson<ProviderSettings>(`/api/settings/${provider}`, { method: "GET" }, "获取配置失败");
}

/** Save connection settings; empty apiKey keeps the currently saved key. */
export async function saveProviderSettings(
  provider: ProviderSection,
  settings: { base_url: string; model: string; api_key?: string },
): Promise<ProviderSettings> {
  return requestJson<ProviderSettings>(
    `/api/settings/${provider}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    },
    "保存配置失败",
  );
}

/** Probe an endpoint for its model list; empty fields use the saved config. */
export async function fetchProviderModels(
  provider: ProviderSection,
  params: { base_url?: string; api_key?: string },
): Promise<ModelListResponse> {
  return requestJson<ModelListResponse>(
    `/api/settings/${provider}/models`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    },
    "获取模型列表失败，请检查地址和 Key",
  );
}
