/**
 * Tests for the image generation service retry contract.
 *
 * Port of the service-level tests in `backend/tests/test_image.py`:
 * retry-then-succeed, retries-exhausted -> unavailable, and non-transient
 * errors propagating without retry. All network is faked via the injectable
 * fetch; retryDelaySeconds is 0 so tests run instantly.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  generateImage,
  ImageGenerationUnavailableError,
  type ImageFetch,
  type ImageFetchInit,
  type ImageFetchResponse,
} from "@/lib/image-service";

type Outcome = Error | ImageFetchResponse;

interface FakeTransport {
  fetchImpl: ImageFetch;
  calls: Array<{ url: string; init: ImageFetchInit }>;
}

/** A fetch stub that replays queued outcomes (errors are thrown). */
function transportWith(outcomes: Outcome[]): FakeTransport {
  const queue = [...outcomes];
  const calls: FakeTransport["calls"] = [];
  const fetchImpl: ImageFetch = async (url, init) => {
    calls.push({ url, init });
    const outcome = queue.shift();
    if (outcome === undefined) {
      throw new Error("fake transport exhausted");
    }
    if (outcome instanceof Error) {
      throw outcome;
    }
    return outcome;
  };
  return { fetchImpl, calls };
}

function jsonResponse(status: number, payload: unknown): ImageFetchResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
}

function urlResponse(url: string): ImageFetchResponse {
  return jsonResponse(200, { data: [{ url, b64_json: null }] });
}

function options(fetchImpl: ImageFetch) {
  return {
    baseUrl: "https://image.example/v1",
    apiKey: "test-image-key",
    model: "gpt-image-2",
    retryDelaySeconds: 0,
    fetchImpl,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generateImage retry contract", () => {
  it("retries transient failures (connection drop, 5xx) then succeeds", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = transportWith([
      new Error("socket hang up"), // dropped connection
      jsonResponse(502, {}), // upstream 5xx
      urlResponse("https://example.test/ok.png"),
    ]);

    const url = await generateImage("a bright study room", options(transport.fetchImpl));

    expect(url).toBe("https://example.test/ok.png");
    expect(transport.calls).toHaveLength(3);
  });

  it("treats HTTP 429 as transient", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = transportWith([
      jsonResponse(429, {}),
      urlResponse("https://example.test/ok.png"),
    ]);

    const url = await generateImage("a bright study room", options(transport.fetchImpl));

    expect(url).toBe("https://example.test/ok.png");
    expect(transport.calls).toHaveLength(2);
  });

  it("raises ImageGenerationUnavailableError after all retries fail transiently", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = transportWith([
      new Error("socket hang up"),
      new Error("socket hang up"),
      jsonResponse(502, {}),
    ]);

    await expect(
      generateImage("a bright study room", options(transport.fetchImpl)),
    ).rejects.toBeInstanceOf(ImageGenerationUnavailableError);
    expect(transport.calls).toHaveLength(3);
  });

  it("does not retry non-transient errors (empty response data)", async () => {
    const transport = transportWith([jsonResponse(200, { data: [] })]);

    await expect(
      generateImage("a bright study room", options(transport.fetchImpl)),
    ).rejects.toThrow("No image data in response");
    expect(transport.calls).toHaveLength(1);
  });

  it("does not retry non-transient HTTP errors (4xx)", async () => {
    const transport = transportWith([jsonResponse(401, {})]);

    await expect(
      generateImage("a bright study room", options(transport.fetchImpl)),
    ).rejects.toThrow("status 401");
    expect(transport.calls).toHaveLength(1);
  });

  it("returns a data URL for base64 payloads", async () => {
    const transport = transportWith([jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }] })]);

    const url = await generateImage("a cozy bedroom", options(transport.fetchImpl));

    expect(url).toBe("data:image/png;base64,aGVsbG8=");
  });

  it("rejects when the image has neither url nor b64_json", async () => {
    const transport = transportWith([jsonResponse(200, { data: [{ url: "", b64_json: null }] })]);

    await expect(
      generateImage("a cozy bedroom", options(transport.fetchImpl)),
    ).rejects.toThrow("No image URL or base64 data in response");
    expect(transport.calls).toHaveLength(1);
  });

  it("sends the OpenAI-compatible request shape with bearer auth", async () => {
    const transport = transportWith([urlResponse("https://example.test/ok.png")]);

    await generateImage("a modern kitchen", options(transport.fetchImpl));

    const [{ url, init }] = transport.calls;
    expect(url).toBe("https://image.example/v1/images/generations");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer test-image-key");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-image-2",
      prompt: "a modern kitchen",
      n: 1,
      size: "1024x1024",
    });
  });
});
