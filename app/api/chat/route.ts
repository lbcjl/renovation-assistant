/**
 * Streaming chat endpoint (replaces FastAPI POST /chat/stream).
 *
 * Accepts the `useChat` UI message payload, retrieves knowledge for the
 * latest user question, builds the grounded system prompt server-side, and
 * streams the answer back as a UI message stream. The deduped sources are
 * sent first as a custom `data-sources` part so the UI can render the 依据
 * chips; mid-stream provider failures surface as a readable error part.
 */

import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type ModelMessage,
} from "ai";

import { dedupSources, latestUserText, parseChatRequest, type ChatUIMessage } from "@/lib/chat";
import { getSettings } from "@/lib/config";
import { buildSystemPrompt, formatContextBlocks } from "@/lib/prompts";
import { getRetriever } from "@/lib/rag/factory";
import { loadProviderConfig } from "@/lib/runtime-config";

export const runtime = "nodejs";

function streamErrorMessage(error: unknown): string {
  // Never leak provider details to the client (parity with the FastAPI SSE
  // error event `{"detail": "LLM provider error"}`).
  console.error("LLM streaming failed:", error);
  return "LLM provider error";
}

export async function POST(request: Request): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ detail: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = parseChatRequest(raw);
  if (!parsed.ok) {
    return Response.json({ detail: parsed.detail }, { status: 400 });
  }
  const { messages, model } = parsed.value;

  // Runtime config is loaded per request so settings-page changes apply
  // without a restart.
  const settings = getSettings();
  const config = loadProviderConfig("llm", settings);

  // Retrieve knowledge for the latest user message (empty hits when no index
  // has been built yet) and assemble the grounded system prompt.
  const context = await getRetriever().retrieve(latestUserText(messages));
  const systemPrompt = buildSystemPrompt(formatContextBlocks(context.hits));
  const sources = dedupSources(context.hits);

  // The server owns the system prompt; drop client-sent system messages.
  const conversation = messages.filter((message) => message.role !== "system");
  let modelMessages: ModelMessage[];
  try {
    modelMessages = await convertToModelMessages(conversation);
  } catch {
    return Response.json({ detail: "Invalid message format" }, { status: 400 });
  }

  const provider = createOpenAICompatible({
    name: "chat-llm",
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });
  const timeoutMs = Math.max(1, Math.round(settings.requestTimeoutSeconds * 1000));

  const stream = createUIMessageStream<ChatUIMessage>({
    execute: ({ writer }) => {
      writer.write({ type: "data-sources", data: sources });
      const result = streamText({
        model: provider.chatModel(model ?? config.model),
        system: systemPrompt,
        messages: modelMessages,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
      writer.merge(result.toUIMessageStream<ChatUIMessage>({ onError: streamErrorMessage }));
    },
    onError: streamErrorMessage,
  });
  return createUIMessageStreamResponse({ stream });
}
