/**
 * Tests for the /api/settings/{provider} route handlers.
 *
 * Port of the endpoint contracts in `backend/tests/test_provider_settings.py`:
 * env defaults with masked key, persist + reflect, empty-key-keeps-saved,
 * no-key 400, bad base_url 400, unknown provider 404, models probe
 * (success / 503 / 502), and section isolation when saving.
 *
 * Handlers are invoked directly with Request objects; the persisted config
 * is redirected to a temp file via PROVIDER_CONFIG_PATH and all upstream
 * network is mocked by stubbing the global fetch.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as postModels } from "@/app/api/settings/[provider]/models/route";
import { GET as getSettingsRoute, PUT as putSettingsRoute } from "@/app/api/settings/[provider]/route";
import { resetSettingsCache } from "@/lib/config";

const TEST_ENV: Record<string, string> = {
  LLM_API_KEY: "test-llm-key-1234567890",
  LLM_BASE_URL: "https://relay.example/v1",
  LLM_MODEL: "claude-opus-4-6",
  IMAGE_API_KEY: "test-image-key-1234567890",
  IMAGE_BASE_URL: "https://image.example/v1",
  IMAGE_MODEL: "gpt-image-2",
};

let tempDir: string;
let savedEnv: Record<string, string | undefined>;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "settings-routes-test-"));
  savedEnv = {};
  for (const [key, value] of Object.entries(TEST_ENV)) {
    savedEnv[key] = process.env[key];
    process.env[key] = value;
  }
  savedEnv["PROVIDER_CONFIG_PATH"] = process.env["PROVIDER_CONFIG_PATH"];
  process.env["PROVIDER_CONFIG_PATH"] = path.join(tempDir, "provider_config.json");
  resetSettingsCache();
});

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  resetSettingsCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function routeContext(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

function getRequest(provider: string): Request {
  return new Request(`http://test.local/api/settings/${provider}`);
}

function jsonRequest(provider: string, method: string, body: unknown, suffix = ""): Request {
  return new Request(`http://test.local/api/settings/${provider}${suffix}`, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function getProvider(provider: string): Promise<Response> {
  return getSettingsRoute(getRequest(provider), routeContext(provider));
}

async function putProvider(provider: string, body: unknown): Promise<Response> {
  return putSettingsRoute(jsonRequest(provider, "PUT", body), routeContext(provider));
}

async function fetchModels(provider: string, body: unknown): Promise<Response> {
  return postModels(jsonRequest(provider, "POST", body, "/models"), routeContext(provider));
}

describe("GET /api/settings/{provider}", () => {
  it("returns env defaults with a masked key", async () => {
    const response = await getProvider("llm");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.base_url).toBe("https://relay.example/v1");
    expect(body.model).toBe("claude-opus-4-6");
    expect(body.api_key_set).toBe(true);
    expect(body.api_key_preview).toBe("test-l...7890");
    expect(body.api_key_preview).not.toContain("test-llm-key");
  });

  it("uses image defaults for the image section", async () => {
    const response = await getProvider("image");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.base_url).toBe("https://image.example/v1");
    expect(body.model).toBe("gpt-image-2");
  });

  it("rejects an unknown provider with 404", async () => {
    const response = await getProvider("nope");

    expect(response.status).toBe(404);
  });
});

describe("PUT /api/settings/{provider}", () => {
  it("persists settings and GET reflects them", async () => {
    const putResponse = await putProvider("llm", {
      base_url: "https://new-relay.example/v1",
      api_key: "new-key-abcdefghijkl",
      model: "gpt-5.4",
    });

    expect(putResponse.status).toBe(200);
    const body = await (await getProvider("llm")).json();
    expect(body.base_url).toBe("https://new-relay.example/v1");
    expect(body.model).toBe("gpt-5.4");
    expect(body.api_key_preview).toBe("new-ke...ijkl");
  });

  it("keeps the saved key when api_key is omitted", async () => {
    await putProvider("llm", {
      base_url: "https://relay.example/v1",
      api_key: "saved-key-abcdefghij",
      model: "claude-opus-4-6",
    });

    const response = await putProvider("llm", {
      base_url: "https://relay.example/v1",
      model: "gpt-5.4",
    });

    expect(response.status).toBe(200);
    expect((await response.json()).api_key_preview).toBe("saved-...ghij");
  });

  it("returns 400 when no key is provided and none is saved", async () => {
    delete process.env["LLM_API_KEY"];
    resetSettingsCache();

    const response = await putProvider("llm", {
      base_url: "https://relay.example/v1",
      model: "gpt-5.4",
    });

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("API key is required");
  });

  it("rejects a non-http base_url with 400", async () => {
    const response = await putProvider("llm", {
      base_url: "ftp://relay.example",
      model: "gpt-5.4",
    });

    expect(response.status).toBe(400);
  });

  it("rejects an unknown provider with 404", async () => {
    const response = await putProvider("nope", {
      base_url: "https://relay.example/v1",
      model: "gpt-5.4",
    });

    expect(response.status).toBe(404);
  });

  it("saving llm keeps the image section intact", async () => {
    await putProvider("image", {
      base_url: "https://new-image.example/v1",
      api_key: "image-key-abcdefghij",
      model: "gpt-image-3",
    });
    await putProvider("llm", {
      base_url: "https://new-relay.example/v1",
      api_key: "llm-key-abcdefghijkl",
      model: "gpt-5.4",
    });

    const body = await (await getProvider("image")).json();
    expect(body.base_url).toBe("https://new-image.example/v1");
    expect(body.model).toBe("gpt-image-3");
  });
});

describe("POST /api/settings/{provider}/models", () => {
  it("uses request credentials and returns sorted unique model ids", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              { id: "gpt-5.4-mini" },
              { id: "claude-opus-4-6" },
              { id: "claude-opus-4-6" },
              { id: 42 },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchModels("llm", {
      base_url: "https://probe.example/v1",
      api_key: "probe-key",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      models: ["claude-opus-4-6", "gpt-5.4-mini"],
      default: "claude-opus-4-6",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://probe.example/v1/models");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer probe-key");
  });

  it("falls back to saved credentials", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: "claude-opus-4-6" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchModels("llm", {});

    expect(response.status).toBe(200);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://relay.example/v1/models");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-llm-key-1234567890",
    );
  });

  it("returns 503 when no key is provided and none is saved", async () => {
    delete process.env["LLM_API_KEY"];
    resetSettingsCache();

    const response = await fetchModels("llm", {});

    expect(response.status).toBe(503);
    expect((await response.json()).detail).toBe("llm provider not configured");
  });

  it("returns 502 when the upstream fetch fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("boom");
      }),
    );

    const response = await fetchModels("llm", {});

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("Failed to list models");
  });

  it("rejects an unknown provider with 404", async () => {
    const response = await fetchModels("nope", {});

    expect(response.status).toBe(404);
  });
});
