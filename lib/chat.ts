/**
 * Chat request validation and source handling for the chat route.
 *
 * Ports the request guards from `backend/app/schemas.py` (`ChatRequest`) and
 * `_dedup_sources` from `backend/app/main.py`. Lives in `lib/` (not in the
 * route file) because Next.js route modules may only export HTTP handlers,
 * and the Phase C UI needs the `ChatUIMessage` / `ChatSource` types to render
 * the 依据 (sources) chips from the `data-sources` stream part.
 */

import type { UIMessage } from "ai";

import type { SearchHit } from "@/lib/rag/store";

// Guard rails on incoming requests (size limits; cheap abuse/injection mitigation).
export const MAX_MESSAGES = 40;
export const MAX_MESSAGE_CHARS = 4000;

/** A knowledge-base source used to ground an answer. */
export interface ChatSource {
  source: string;
  score: number;
}

/** Custom data parts streamed to the client alongside the answer. */
export interface ChatDataParts {
  sources: ChatSource[];
  [key: string]: unknown;
}

/** The UI message shape exchanged with `useChat` (includes `data-sources`). */
export type ChatUIMessage = UIMessage<unknown, ChatDataParts>;

export interface ChatRequestBody {
  messages: ChatUIMessage[];
  /** Optional override of the server-configured chat model. */
  model?: string;
}

export type ParseResult =
  | { ok: true; value: ChatRequestBody }
  | { ok: false; detail: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUIMessageLike(value: unknown): value is ChatUIMessage {
  if (!isRecord(value)) {
    return false;
  }
  const role = value["role"];
  if (role !== "system" && role !== "user" && role !== "assistant") {
    return false;
  }
  const parts = value["parts"];
  if (!Array.isArray(parts)) {
    return false;
  }
  return parts.every(
    (part) =>
      isRecord(part) &&
      typeof part["type"] === "string" &&
      (part["type"] !== "text" || typeof part["text"] === "string"),
  );
}

/** Concatenated text content of a UI message (mirror of `ChatMessage.content`). */
export function messageText(message: ChatUIMessage): string {
  return message.parts
    .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("");
}

/**
 * Validate the request body sent by `useChat`.
 *
 * Mirrors `ChatRequest`: 1-40 messages, each message's text content capped at
 * 4000 chars, optional model override of 1-100 chars.
 */
export function parseChatRequest(body: unknown): ParseResult {
  if (!isRecord(body)) {
    return { ok: false, detail: "Request body must be a JSON object" };
  }
  const rawMessages = body["messages"];
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return { ok: false, detail: "messages must be a non-empty array" };
  }
  if (rawMessages.length > MAX_MESSAGES) {
    return { ok: false, detail: `messages exceeds ${MAX_MESSAGES} items` };
  }
  const messages: ChatUIMessage[] = [];
  for (const raw of rawMessages) {
    if (!isUIMessageLike(raw)) {
      return { ok: false, detail: "Invalid message format" };
    }
    if (messageText(raw).length > MAX_MESSAGE_CHARS) {
      return { ok: false, detail: `message content exceeds ${MAX_MESSAGE_CHARS} characters` };
    }
    messages.push(raw);
  }
  const rawModel = body["model"];
  let model: string | undefined;
  if (rawModel !== undefined && rawModel !== null) {
    if (typeof rawModel !== "string" || rawModel.length < 1 || rawModel.length > 100) {
      return { ok: false, detail: "model must be a string of 1-100 characters" };
    }
    model = rawModel;
  }
  return { ok: true, value: { messages, model } };
}

/**
 * Sources carried by a message's `data-sources` part (empty when absent).
 *
 * The cast is needed because `ChatDataParts` carries an index signature (to
 * satisfy the `UIDataTypes` constraint), which widens `part.data` to
 * `unknown`; the server only ever writes `ChatSource[]` into this part.
 */
export function messageSources(message: ChatUIMessage): ChatSource[] {
  for (const part of message.parts) {
    if (part.type === "data-sources") {
      return part.data as ChatSource[];
    }
  }
  return [];
}

/** Latest user message text (the retrieval query). */
export function latestUserText(messages: ChatUIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return messageText(messages[index]);
    }
  }
  return "";
}

/** Dedupe hits by source name, keeping the max score rounded to 3 decimals. */
export function dedupSources(hits: SearchHit[]): ChatSource[] {
  const best = new Map<string, number>();
  for (const hit of hits) {
    best.set(hit.document.source, Math.max(best.get(hit.document.source) ?? 0, hit.score));
  }
  return Array.from(best, ([source, score]) => ({
    source,
    score: Math.round(score * 1000) / 1000,
  }));
}
