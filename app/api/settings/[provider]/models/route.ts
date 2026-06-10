/**
 * POST /api/settings/{provider}/models — probe an OpenAI-compatible endpoint
 * for its available models before saving.
 *
 * Port of `backend/app/routers/provider_settings.py::list_models`. Request
 * fields fall back to the saved configuration so the settings page can probe
 * a new base URL / key before saving. The image relay may only be reachable
 * through the configured proxy (IMAGE_PROXY_URL), mirroring
 * `httpx.AsyncClient(proxy=..., trust_env=False)`.
 */

import { ProxyAgent } from "undici";

import { getSettings } from "@/lib/config";
import { loadProviderConfig, type ProviderSection } from "@/lib/runtime-config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ provider: string }> };

const LIST_TIMEOUT_MS = 15_000;

function parseProvider(value: string): ProviderSection | null {
  return value === "llm" || value === "image" ? value : null;
}

/** Return the model ids served by an OpenAI-compatible `/models` endpoint. */
async function fetchModelIds(
  baseUrl: string,
  apiKey: string,
  proxyUrl: string,
): Promise<string[]> {
  const init: RequestInit & { dispatcher?: ProxyAgent } = {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
  };
  if (proxyUrl) {
    init.dispatcher = new ProxyAgent(proxyUrl);
  }
  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/models`, init);
  if (!response.ok) {
    throw new Error(`models request failed with status ${response.status}`);
  }
  const payload: unknown = await response.json();
  const ids = new Set<string>();
  if (typeof payload === "object" && payload !== null) {
    const data = (payload as { data?: unknown }).data;
    if (Array.isArray(data)) {
      for (const item of data) {
        const id = (item as { id?: unknown } | null)?.id;
        if (typeof id === "string") {
          ids.add(id);
        }
      }
    }
  }
  return Array.from(ids).sort();
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { provider } = await context.params;
  const section = parseProvider(provider);
  if (section === null) {
    return Response.json({ detail: "Unknown provider" }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // An empty/absent body means "use the saved configuration".
  }
  const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
  const rawBaseUrl = raw["base_url"];
  const rawApiKey = raw["api_key"];
  if (
    (rawBaseUrl !== undefined && rawBaseUrl !== null && typeof rawBaseUrl !== "string") ||
    (typeof rawBaseUrl === "string" && rawBaseUrl.length > 500)
  ) {
    return Response.json(
      { detail: "base_url must be a string of at most 500 characters" },
      { status: 400 },
    );
  }
  if (
    (rawApiKey !== undefined && rawApiKey !== null && typeof rawApiKey !== "string") ||
    (typeof rawApiKey === "string" && rawApiKey.length > 500)
  ) {
    return Response.json(
      { detail: "api_key must be a string of at most 500 characters" },
      { status: 400 },
    );
  }

  const settings = getSettings();
  const current = loadProviderConfig(section, settings);
  const baseUrl = (typeof rawBaseUrl === "string" && rawBaseUrl) || current.baseUrl;
  const apiKey = (typeof rawApiKey === "string" && rawApiKey) || current.apiKey;
  if (!apiKey) {
    return Response.json({ detail: `${section} provider not configured` }, { status: 503 });
  }

  const proxyUrl = section === "image" ? settings.imageProxyUrl : "";
  let models: string[];
  try {
    models = await fetchModelIds(baseUrl, apiKey, proxyUrl);
  } catch (error) {
    console.error(`Failed to list models from ${section} endpoint:`, error);
    return Response.json({ detail: "Failed to list models" }, { status: 502 });
  }
  return Response.json({ models, default: current.model });
}
