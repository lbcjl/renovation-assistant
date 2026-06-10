/**
 * Image generation service against an OpenAI-compatible images API.
 *
 * Port of `backend/app/services/image_service.py`. The OpenAI SDK is replaced
 * with plain `fetch` (injectable for tests); the retry contract is identical:
 * up to 3 attempts, sleeping `retryDelaySeconds * (attempt - 1)` before each
 * retry. Transient failures (dropped connections / timeouts, HTTP 5xx, HTTP
 * 429) are retried; everything else (other HTTP errors, empty or invalid
 * response bodies) propagates immediately.
 *
 * Text-only prompts POST JSON to `/images/generations`; prompts with a
 * reference image (e.g. a floor plan to turn into a design rendering) POST
 * multipart form data to `/images/edits`.
 *
 * Proxy support mirrors `httpx.AsyncClient(proxy=..., trust_env=False)`:
 * only the explicitly configured proxy is used (Node's fetch ignores
 * HTTP(S)_PROXY environment variables by default), passed to undici as a
 * `dispatcher`.
 */

import { ProxyAgent, type Dispatcher } from "undici";

/** The upstream image provider kept failing transiently after all retries. */
export class ImageGenerationUnavailableError extends Error {}

/** Internal marker for failures worth retrying. */
class TransientImageError extends Error {}

/** The subset of a fetch Response the service needs (easy to fake in tests). */
export interface ImageFetchResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface ImageFetchInit {
  method: "POST";
  headers: Record<string, string>;
  body: string | FormData;
  signal?: AbortSignal;
  dispatcher?: Dispatcher;
}

/** Injectable transport (defaults to the global undici-backed `fetch`). */
export type ImageFetch = (url: string, init: ImageFetchInit) => Promise<ImageFetchResponse>;

/** A reference image sent along with the prompt (image-to-image). */
export interface ImageInput {
  data: Uint8Array;
  mimeType: string;
  filename: string;
}

export interface GenerateImageOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Reference image; switches the request to the /images/edits endpoint. */
  image?: ImageInput;
  /** Image dimensions, e.g. "1024x1024"; controls the aspect ratio. */
  size?: string;
  /** Provider quality hint (e.g. low/medium/high); omitted when empty. */
  quality?: string;
  /** Number of images to generate (provider-side `n`). */
  n?: number;
  /** Outbound proxy URL; empty string disables proxying. */
  proxyUrl?: string;
  /** Per-attempt request timeout in seconds. */
  timeoutSeconds?: number;
  maxAttempts?: number;
  retryDelaySeconds?: number;
  fetchImpl?: ImageFetch;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_SECONDS = 2.0;

function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Generate one or more images and return their URLs (data: URLs for base64
 * payloads). The returned array always has at least one entry; providers that
 * return fewer images than requested are not treated as an error.
 *
 * @throws ImageGenerationUnavailableError All attempts failed transiently.
 * @throws Error Non-transient generation failure.
 */
export async function generateImages(
  prompt: string,
  options: GenerateImageOptions,
): Promise<string[]> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const retryDelaySeconds = options.retryDelaySeconds ?? DEFAULT_RETRY_DELAY_SECONDS;
  const fetchImpl = options.fetchImpl ?? (fetch as unknown as ImageFetch);
  const dispatcher = options.proxyUrl ? new ProxyAgent(options.proxyUrl) : undefined;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (attempt > 1) {
      await sleep(retryDelaySeconds * (attempt - 1) * 1000);
    }
    try {
      return await requestImage(prompt, options, fetchImpl, dispatcher);
    } catch (error) {
      if (!(error instanceof TransientImageError)) {
        throw error;
      }
      lastError = error;
      console.warn(
        `Transient image generation failure (attempt ${attempt}/${maxAttempts}): ${error.message}`,
      );
    }
  }
  throw new ImageGenerationUnavailableError(
    `Image provider failed after ${maxAttempts} attempts`,
    { cause: lastError },
  );
}

async function requestImage(
  prompt: string,
  options: GenerateImageOptions,
  fetchImpl: ImageFetch,
  dispatcher: Dispatcher | undefined,
): Promise<string[]> {
  const base = options.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.apiKey}`,
  };
  let url: string;
  let body: string | FormData;
  if (options.image !== undefined) {
    // Image-to-image: multipart /images/edits. Content-Type is set by fetch
    // itself so the multipart boundary is included.
    url = `${base}/images/edits`;
    const form = new FormData();
    form.append("model", options.model);
    form.append("prompt", prompt);
    form.append("n", String(options.n ?? 1));
    form.append("size", options.size ?? "1024x1024");
    if (options.quality) {
      form.append("quality", options.quality);
    }
    form.append(
      "image",
      new Blob([options.image.data as BlobPart], { type: options.image.mimeType }),
      options.image.filename,
    );
    body = form;
  } else {
    url = `${base}/images/generations`;
    headers["Content-Type"] = "application/json";
    const requestBody: Record<string, unknown> = {
      model: options.model,
      prompt,
      n: options.n ?? 1,
      size: options.size ?? "1024x1024",
    };
    if (options.quality) {
      requestBody["quality"] = options.quality;
    }
    body = JSON.stringify(requestBody);
  }
  const init: ImageFetchInit = {
    method: "POST",
    headers,
    body,
  };
  if (options.timeoutSeconds !== undefined) {
    init.signal = AbortSignal.timeout(Math.max(1, Math.round(options.timeoutSeconds * 1000)));
  }
  if (dispatcher !== undefined) {
    init.dispatcher = dispatcher;
  }

  let response: ImageFetchResponse;
  try {
    response = await fetchImpl(url, init);
  } catch (error) {
    // Dropped connection / timeout (the Python APIConnectionError equivalent).
    throw new TransientImageError(
      `connection error: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
  if (response.status >= 500 || response.status === 429) {
    throw new TransientImageError(`upstream HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`Image generation request failed with status ${response.status}`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error("Invalid JSON in image provider response", { cause: error });
  }
  const data = isRecord(payload) ? payload["data"] : undefined;
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error("No image data in response");
  }
  const urls: string[] = [];
  for (const image of data) {
    if (!isRecord(image)) {
      continue;
    }
    if (typeof image["url"] === "string" && image["url"]) {
      urls.push(image["url"]);
    } else if (typeof image["b64_json"] === "string" && image["b64_json"]) {
      urls.push(`data:image/png;base64,${image["b64_json"]}`);
    }
  }
  if (urls.length === 0) {
    throw new Error("No image URL or base64 data in response");
  }
  return urls;
}
