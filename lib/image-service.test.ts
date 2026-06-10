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
  generateImages,
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

describe("generateImages retry contract", () => {
  it("retries transient failures (connection drop, 5xx) then succeeds", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = transportWith([
      new Error("socket hang up"), // dropped connection
      jsonResponse(502, {}), // upstream 5xx
      urlResponse("https://example.test/ok.png"),
    ]);

    const urls = await generateImages("a bright study room", options(transport.fetchImpl));

    expect(urls).toEqual(["https://example.test/ok.png"]);
    expect(transport.calls).toHaveLength(3);
  });

  it("treats HTTP 429 as transient", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const transport = transportWith([
      jsonResponse(429, {}),
      urlResponse("https://example.test/ok.png"),
    ]);

    const urls = await generateImages("a bright study room", options(transport.fetchImpl));

    expect(urls).toEqual(["https://example.test/ok.png"]);
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
      generateImages("a bright study room", options(transport.fetchImpl)),
    ).rejects.toBeInstanceOf(ImageGenerationUnavailableError);
    expect(transport.calls).toHaveLength(3);
  });

  it("does not retry non-transient errors (empty response data)", async () => {
    const transport = transportWith([jsonResponse(200, { data: [] })]);

    await expect(
      generateImages("a bright study room", options(transport.fetchImpl)),
    ).rejects.toThrow("No image data in response");
    expect(transport.calls).toHaveLength(1);
  });

  it("does not retry non-transient HTTP errors (4xx)", async () => {
    const transport = transportWith([jsonResponse(401, {})]);

    await expect(
      generateImages("a bright study room", options(transport.fetchImpl)),
    ).rejects.toThrow("status 401");
    expect(transport.calls).toHaveLength(1);
  });

  it("returns a data URL for base64 payloads", async () => {
    const transport = transportWith([jsonResponse(200, { data: [{ b64_json: "aGVsbG8=" }] })]);

    const urls = await generateImages("a cozy bedroom", options(transport.fetchImpl));

    expect(urls).toEqual(["data:image/png;base64,aGVsbG8="]);
  });

  it("rejects when the image has neither url nor b64_json", async () => {
    const transport = transportWith([jsonResponse(200, { data: [{ url: "", b64_json: null }] })]);

    await expect(
      generateImages("a cozy bedroom", options(transport.fetchImpl)),
    ).rejects.toThrow("No image URL or base64 data in response");
    expect(transport.calls).toHaveLength(1);
  });

  it("sends the OpenAI-compatible request shape with bearer auth", async () => {
    const transport = transportWith([urlResponse("https://example.test/ok.png")]);

    await generateImages("a modern kitchen", options(transport.fetchImpl));

    const [{ url, init }] = transport.calls;
    expect(url).toBe("https://image.example/v1/images/generations");
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer test-image-key");
    expect(JSON.parse(init.body as string)).toEqual({
      model: "gpt-image-2",
      prompt: "a modern kitchen",
      n: 1,
      size: "1024x1024",
    });
  });

  it("passes size, quality and n through to the provider", async () => {
    const transport = transportWith([
      jsonResponse(200, {
        data: [{ url: "https://example.test/1.png" }, { url: "https://example.test/2.png" }],
      }),
    ]);

    const urls = await generateImages("a modern kitchen", {
      ...options(transport.fetchImpl),
      size: "1792x1024",
      quality: "high",
      n: 2,
    });

    expect(urls).toEqual(["https://example.test/1.png", "https://example.test/2.png"]);
    const [{ init }] = transport.calls;
    expect(JSON.parse(init.body as string)).toEqual({
      model: "gpt-image-2",
      prompt: "a modern kitchen",
      n: 2,
      size: "1792x1024",
      quality: "high",
    });
  });

  it("sends multipart form data to /images/edits when a reference image is given", async () => {
    const transport = transportWith([urlResponse("https://example.test/design.png")]);

    const urls = await generateImages("turn this floor plan into a rendering", {
      ...options(transport.fetchImpl),
      image: {
        data: new Uint8Array([1, 2, 3]),
        mimeType: "image/png",
        filename: "floor-plan.png",
      },
      n: 2,
      size: "1536x1024",
      quality: "high",
    });

    expect(urls).toEqual(["https://example.test/design.png"]);
    const [{ url, init }] = transport.calls;
    expect(url).toBe("https://image.example/v1/images/edits");
    expect(init.headers["Authorization"]).toBe("Bearer test-image-key");
    // Content-Type must be unset so fetch adds the multipart boundary itself.
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-image-2");
    expect(form.get("prompt")).toBe("turn this floor plan into a rendering");
    expect(form.get("n")).toBe("2");
    expect(form.get("size")).toBe("1536x1024");
    expect(form.get("quality")).toBe("high");
    const file = form.get("image");
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("floor-plan.png");
    expect((file as File).type).toBe("image/png");
  });

  it("collects mixed url and base64 images, skipping invalid entries", async () => {
    const transport = transportWith([
      jsonResponse(200, {
        data: [{ url: "https://example.test/1.png" }, "garbage", { b64_json: "aGVsbG8=" }],
      }),
    ]);

    const urls = await generateImages("a cozy bedroom", options(transport.fetchImpl));

    expect(urls).toEqual(["https://example.test/1.png", "data:image/png;base64,aGVsbG8="]);
  });
});
