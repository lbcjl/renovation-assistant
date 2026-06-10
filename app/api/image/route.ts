/**
 * Image generation endpoint (replaces FastAPI POST /image/generate).
 *
 * Accepts either a JSON body (text-to-image) or multipart form data with a
 * reference image such as a floor plan (image-to-image via /images/edits).
 *
 * Error matrix (port of `backend/app/routers/image.py`):
 *
 * | Condition                                  | Status | detail                                |
 * |--------------------------------------------|--------|---------------------------------------|
 * | Invalid prompt (empty / >1000 chars)       | 400    | validation message                    |
 * | Invalid size / quality / count / image     | 400    | validation message                    |
 * | Image API key not configured               | 503    | Image generation not configured       |
 * | Transient upstream failure, retries spent  | 503    | Image service temporarily unavailable |
 * | Any other generation failure               | 502    | Image generation failed               |
 */

import { getSettings } from "@/lib/config";
import {
  generateImages,
  ImageGenerationUnavailableError,
  type ImageInput,
} from "@/lib/image-service";
import { loadProviderConfig } from "@/lib/runtime-config";

export const runtime = "nodejs";

/** Aspect-ratio presets exposed to the UI, as provider pixel sizes. */
const ALLOWED_SIZES = new Set([
  "1024x1024", // 1:1
  "1536x1024", // 3:2 landscape
  "1024x1536", // 2:3 portrait
  "1792x1024", // 16:9 landscape
  "1024x1792", // 9:16 portrait
]);

/** Quality hints accepted by OpenAI-compatible providers. */
const ALLOWED_QUALITIES = new Set(["low", "medium", "high", "standard", "hd"]);

const MAX_IMAGE_COUNT = 4;

/** Reference image constraints (floor plans are photos or exported drawings). */
const ALLOWED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

interface ImageRequestParams {
  prompt: unknown;
  size: unknown;
  quality: unknown;
  n: unknown;
  image?: File;
}

/** Either parsed params or an error Response ready to return. */
type ParsedRequest = { ok: true; params: ImageRequestParams } | { ok: false; response: Response };

function badRequest(detail: string): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ detail }, { status: 400 }) };
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return badRequest("Invalid form data");
    }
    const image = form.get("image");
    if (!(image instanceof File) || image.size === 0) {
      return badRequest("Reference image is missing or empty");
    }
    if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
      return badRequest("Reference image must be PNG, JPEG or WebP");
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return badRequest("Reference image must be 10MB or smaller");
    }
    const rawN = form.get("n");
    return {
      ok: true,
      params: {
        prompt: form.get("prompt") ?? undefined,
        size: form.get("size") ?? undefined,
        quality: form.get("quality") ?? undefined,
        n: typeof rawN === "string" && rawN !== "" ? Number(rawN) : undefined,
        image,
      },
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const record = (body ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    params: {
      prompt: record["prompt"],
      size: record["size"],
      quality: record["quality"],
      n: record["n"],
    },
  };
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await parseRequest(request);
  if (!parsed.ok) {
    return parsed.response;
  }
  const { prompt, size, quality, n, image } = parsed.params;
  if (typeof prompt !== "string" || prompt.length < 1) {
    return Response.json(
      { detail: "String should have at least 1 character" },
      { status: 400 },
    );
  }
  if (prompt.length > 1000) {
    return Response.json(
      { detail: "String should have at most 1000 characters" },
      { status: 400 },
    );
  }
  if (size !== undefined && (typeof size !== "string" || !ALLOWED_SIZES.has(size))) {
    return Response.json({ detail: "Unsupported image size" }, { status: 400 });
  }
  // Empty string means "auto": let the provider pick its default quality.
  if (
    quality !== undefined &&
    (typeof quality !== "string" || (quality !== "" && !ALLOWED_QUALITIES.has(quality)))
  ) {
    return Response.json({ detail: "Unsupported image quality" }, { status: 400 });
  }
  if (
    n !== undefined &&
    (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > MAX_IMAGE_COUNT)
  ) {
    return Response.json(
      { detail: `Image count must be an integer between 1 and ${MAX_IMAGE_COUNT}` },
      { status: 400 },
    );
  }

  let imageInput: ImageInput | undefined;
  if (image !== undefined) {
    imageInput = {
      data: new Uint8Array(await image.arrayBuffer()),
      mimeType: image.type,
      filename: image.name || "reference.png",
    };
  }

  // Runtime config (settings page) overrides the .env defaults per request.
  const settings = getSettings();
  const config = loadProviderConfig("image", settings);
  if (!config.apiKey) {
    return Response.json({ detail: "Image generation not configured" }, { status: 503 });
  }

  try {
    const imageUrls = await generateImages(prompt, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      image: imageInput,
      size: typeof size === "string" ? size : undefined,
      quality: typeof quality === "string" && quality !== "" ? quality : undefined,
      n: typeof n === "number" ? n : undefined,
      proxyUrl: settings.imageProxyUrl,
      timeoutSeconds: settings.imageTimeoutSeconds,
    });
    // `image_url` is kept for backward compatibility with the single-image shape.
    return Response.json({ image_url: imageUrls[0], image_urls: imageUrls });
  } catch (error) {
    if (error instanceof ImageGenerationUnavailableError) {
      console.warn("Image provider unavailable after retries");
      return Response.json(
        { detail: "Image service temporarily unavailable" },
        { status: 503 },
      );
    }
    console.error("Image generation failed:", error);
    return Response.json({ detail: "Image generation failed" }, { status: 502 });
  }
}
