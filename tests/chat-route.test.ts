/**
 * Tests for the chat route request guards.
 *
 * Ports the `ChatRequest` size-limit contracts from `backend/app/schemas.py`
 * (max 40 messages, max 4000 chars per message). The global fetch is stubbed
 * to fail loudly, proving rejection happens before any model/network call.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST as chatPost } from "@/app/api/chat/route";
import { resetSettingsCache } from "@/lib/config";
import { resetRagSingletons } from "@/lib/rag/factory";

let tempDir: string;
let savedEnv: Record<string, string | undefined>;
let fetchMock: ReturnType<typeof vi.fn>;

const ENV_KEYS = ["LLM_API_KEY", "LLM_BASE_URL", "LLM_MODEL", "INDEX_DIR"] as const;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "chat-route-test-"));
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env["LLM_API_KEY"] = "test-llm-key-1234567890";
  process.env["LLM_BASE_URL"] = "https://relay.example/v1";
  process.env["LLM_MODEL"] = "claude-opus-4-6";
  // Point the index at an empty temp dir: no index -> empty retrieval context.
  process.env["INDEX_DIR"] = path.join(tempDir, "index");
  resetSettingsCache();
  resetRagSingletons();

  fetchMock = vi.fn(async () => {
    throw new Error("unexpected network call");
  });
  vi.stubGlobal("fetch", fetchMock);
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
  resetRagSingletons();
  vi.unstubAllGlobals();
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function uiMessage(text: string, role: "user" | "assistant" = "user") {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role,
    parts: [{ type: "text", text }],
  };
}

function chatRequest(body: unknown): Request {
  return new Request("http://test.local/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat request guards", () => {
  it("rejects more than 40 messages with 400 before any network call", async () => {
    const messages = Array.from({ length: 41 }, (_, index) => uiMessage(`message ${index}`));

    const response = await chatPost(chatRequest({ messages }));

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("messages exceeds 40 items");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a message longer than 4000 chars with 400 before any network call", async () => {
    const messages = [uiMessage("a".repeat(4001))];

    const response = await chatPost(chatRequest({ messages }));

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("message content exceeds 4000 characters");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("counts all text parts of a message towards the 4000-char limit", async () => {
    const message = {
      id: "msg-1",
      role: "user",
      parts: [
        { type: "text", text: "a".repeat(2001) },
        { type: "text", text: "b".repeat(2000) },
      ],
    };

    const response = await chatPost(chatRequest({ messages: [message] }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an empty messages array with 400", async () => {
    const response = await chatPost(chatRequest({ messages: [] }));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid model override with 400", async () => {
    const response = await chatPost(
      chatRequest({ messages: [uiMessage("你好")], model: "x".repeat(101) }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON body with 400", async () => {
    const response = await chatPost(
      new Request("http://test.local/api/chat", { method: "POST", body: "not json" }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
