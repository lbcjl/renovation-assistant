/**
 * Provider settings endpoints: GET/PUT /api/settings/{llm|image}.
 *
 * Port of `backend/app/routers/provider_settings.py` (GET + PUT). The API
 * key is never returned in full — only `api_key_set` and a masked preview.
 * An empty/missing `api_key` on PUT keeps the currently saved key.
 */

import { getSettings } from "@/lib/config";
import {
  loadProviderConfig,
  maskApiKey,
  saveProviderConfig,
  type ProviderConfig,
  type ProviderSection,
} from "@/lib/runtime-config";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ provider: string }> };

function parseProvider(value: string): ProviderSection | null {
  return value === "llm" || value === "image" ? value : null;
}

function toResponseBody(config: ProviderConfig) {
  return {
    base_url: config.baseUrl,
    model: config.model,
    api_key_set: Boolean(config.apiKey),
    api_key_preview: maskApiKey(config.apiKey),
  };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { provider } = await context.params;
  const section = parseProvider(provider);
  if (section === null) {
    return Response.json({ detail: "Unknown provider" }, { status: 404 });
  }
  const settings = getSettings();
  return Response.json(toResponseBody(loadProviderConfig(section, settings)));
}

interface UpdateRequest {
  baseUrl: string;
  model: string;
  apiKey: string | null;
}

function parseUpdateRequest(body: unknown): { ok: true; value: UpdateRequest } | { ok: false; detail: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, detail: "Request body must be a JSON object" };
  }
  const raw = body as Record<string, unknown>;
  const baseUrl = raw["base_url"];
  if (
    typeof baseUrl !== "string" ||
    baseUrl.length < 1 ||
    baseUrl.length > 500 ||
    !/^https?:\/\//.test(baseUrl)
  ) {
    return { ok: false, detail: "base_url must be an http(s) URL of at most 500 characters" };
  }
  const model = raw["model"];
  if (typeof model !== "string" || model.length < 1 || model.length > 100) {
    return { ok: false, detail: "model must be a string of 1-100 characters" };
  }
  const apiKey = raw["api_key"];
  if (apiKey !== undefined && apiKey !== null && typeof apiKey !== "string") {
    return { ok: false, detail: "api_key must be a string" };
  }
  if (typeof apiKey === "string" && apiKey.length > 500) {
    return { ok: false, detail: "api_key must be at most 500 characters" };
  }
  return { ok: true, value: { baseUrl, model, apiKey: typeof apiKey === "string" ? apiKey : null } };
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  const { provider } = await context.params;
  const section = parseProvider(provider);
  if (section === null) {
    return Response.json({ detail: "Unknown provider" }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseUpdateRequest(body);
  if (!parsed.ok) {
    return Response.json({ detail: parsed.detail }, { status: 400 });
  }

  const settings = getSettings();
  const current = loadProviderConfig(section, settings);
  // Empty/missing api_key keeps the currently saved key.
  const apiKey = parsed.value.apiKey || current.apiKey;
  if (!apiKey) {
    return Response.json({ detail: "API key is required" }, { status: 400 });
  }
  const config: ProviderConfig = {
    baseUrl: parsed.value.baseUrl,
    apiKey,
    model: parsed.value.model,
  };
  saveProviderConfig(section, config, settings.providerConfigPath);
  return Response.json(toResponseBody(config));
}
