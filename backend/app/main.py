"""FastAPI application entrypoint.

PR3 scope: streaming chat (POST /chat/stream, Server-Sent Events) on top of the
RAG pipeline, plus request-size guards and a configurable LLM timeout. The
non-streaming POST /chat is kept for simple clients and tests.
"""

import json
import logging
from collections.abc import AsyncIterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import get_settings
from app.llm.base import LLMProvider
from app.llm.factory import get_llm_provider
from app.prompts import build_system_prompt
from app.rag.factory import get_retriever
from app.rag.retriever import RetrievedContext, Retriever
from app.schemas import ChatMessage, ChatRequest, ChatResponse, Source

logger = logging.getLogger("renovation_assistant")

app = FastAPI(title="Renovation Assistant API", version="0.3.0")

_settings = get_settings()
if not _settings.llm_api_key:
    logger.warning("LLM_API_KEY is not set; chat will fail until it is configured.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


def _latest_user_message(messages: list[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user":
            return message.content
    return ""


def _conversation(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Keep only user/assistant turns; the server owns the system prompt."""
    return [message for message in messages if message.role != "system"]


def _format_context_blocks(context: RetrievedContext) -> list[str]:
    return [
        f"【资料{index}｜来源：{hit.document.source}】\n{hit.document.text}"
        for index, hit in enumerate(context.hits, start=1)
    ]


def _dedup_sources(context: RetrievedContext) -> list[Source]:
    best: dict[str, float] = {}
    for hit in context.hits:
        best[hit.document.source] = max(best.get(hit.document.source, 0.0), hit.score)
    return [Source(source=source, score=round(score, 3)) for source, score in best.items()]


async def _build_conversation(
    request: ChatRequest, retriever: Retriever
) -> tuple[list[ChatMessage], list[Source]]:
    """Retrieve knowledge and assemble the system + conversation messages."""
    context = await retriever.retrieve(_latest_user_message(request.messages))
    system_content = build_system_prompt(_format_context_blocks(context))
    conversation = [
        ChatMessage(role="system", content=system_content),
        *_conversation(request.messages),
    ]
    return conversation, _dedup_sources(context)


@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    provider: LLMProvider = Depends(get_llm_provider),
    retriever: Retriever = Depends(get_retriever),
) -> ChatResponse:
    """Answer a renovation question grounded in retrieved knowledge (non-streaming)."""
    conversation, sources = await _build_conversation(request, retriever)
    try:
        reply = await provider.chat(conversation)
    except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
        logger.exception("LLM provider call failed")
        raise HTTPException(status_code=502, detail="LLM provider error") from exc
    return ChatResponse(reply=reply, sources=sources)


def _sse(data: dict, event: str | None = None) -> str:
    """Format a Server-Sent Events message."""
    payload = json.dumps(data, ensure_ascii=False)
    prefix = f"event: {event}\n" if event else ""
    return f"{prefix}data: {payload}\n\n"


@app.post("/chat/stream")
async def chat_stream(
    request: ChatRequest,
    provider: LLMProvider = Depends(get_llm_provider),
    retriever: Retriever = Depends(get_retriever),
) -> StreamingResponse:
    """Stream the answer over SSE: a `sources` event first, then `delta`s, then `done`."""
    conversation, sources = await _build_conversation(request, retriever)

    async def event_stream() -> AsyncIterator[str]:
        yield _sse({"sources": [source.model_dump() for source in sources]}, event="sources")
        try:
            async for delta in provider.chat_stream(conversation):
                yield _sse({"delta": delta})
        except Exception:  # noqa: BLE001 - report mid-stream failures as an SSE event
            logger.exception("LLM streaming failed")
            yield _sse({"detail": "LLM provider error"}, event="error")
            return
        yield _sse({}, event="done")

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
