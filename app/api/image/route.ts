/**
 * Image generation endpoint (replaces FastAPI POST /image/generate).
 *
 * Error matrix (port of `backend/app/routers/image.py`):
 *
 * | Condition                                  | Status | detail                                |
 * |--------------------------------------------|--------|---------------------------------------|
 * | Invalid prompt (empty / >1000 chars)       | 400    | validation message                    |
 * | Image API key not configured               | 503    | Image generation not configured       |
 * | Transient upstream failure, retries spent  | 503    | Image service temporarily unavailable |
 * | Any other generation failure               | 502    | Image generation failed               |
 */

import { getSettings } from "@/lib/config";
import { generateImage, ImageGenerationUnavailableError } from "@/lib/image-service";
import { loadProviderConfig } from "@/lib/runtime-config";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const prompt = (body as { prompt?: unknown } | null)?.prompt;
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

  // Runtime config (settings page) overrides the .env defaults per request.
  const settings = getSettings();
  const config = loadProviderConfig("image", settings);
  if (!config.apiKey) {
    return Response.json({ detail: "Image generation not configured" }, { status: 503 });
  }

  try {
    const imageUrl = await generateImage(prompt, {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      proxyUrl: settings.imageProxyUrl,
      timeoutSeconds: settings.requestTimeoutSeconds,
    });
    return Response.json({ image_url: imageUrl });
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
