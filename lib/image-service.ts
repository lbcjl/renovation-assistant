/**
 * Image generation service against an OpenAI-compatible /images/generations API.
 *
 * Port of `backend/app/services/image_service.py`. The OpenAI SDK is replaced
 * with plain `fetch` (injectable for tests); the retry contract is identical:
 * up to 3 attempts, sleeping `retryDelaySeconds * (attempt - 1)` before each
 * retry. Transient failures (dropped connections / timeouts, HTTP 5xx, HTTP
 * 429) are retried; everything else (other HTTP errors, empty or invalid
 * response bodies) propagates immediately.
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
  body: string;
  signal?: AbortSignal;
  dispatcher?: Dispatcher;
}

/** Injectable transport (defaults to the global undici-backed `fetch`). */
export type ImageFetch = (url: string, init: ImageFetchInit) => Promise<ImageFetchResponse>;

export interface GenerateImageOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
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
 * Generate an image and return its URL (or a data: URL for base64 payloads).
 *
 * @throws ImageGenerationUnavailableError All attempts failed transiently.
 * @throws Error Non-transient generation failure.
 */
export async function generateImage(
  prompt: string,
  options: GenerateImageOptions,
): Promise<string> {
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
): Promise<string> {
  const url = `${options.baseUrl.replace(/\/+$/, "")}/images/generations`;
  const init: ImageFetchInit = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      prompt,
      n: 1,
      size: "1024x1024",
    }),
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
  const image = Array.isArray(data) && data.length > 0 ? data[0] : undefined;
  if (!isRecord(image)) {
    throw new Error("No image data in response");
  }
  if (typeof image["url"] === "string" && image["url"]) {
    return image["url"];
  }
  if (typeof image["b64_json"] === "string" && image["b64_json"]) {
    return `data:image/png;base64,${image["b64_json"]}`;
  }
  throw new Error("No image URL or base64 data in response");
}
