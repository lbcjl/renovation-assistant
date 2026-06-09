"""FastAPI application entrypoint.

PR1 scope: a working request/response chat endpoint backed by a configurable
LLM provider. Retrieval-augmented generation (RAG) is added in PR2.
"""

import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.llm.base import LLMProvider
from app.llm.factory import get_llm_provider
from app.prompts import SYSTEM_PROMPT
from app.schemas import ChatMessage, ChatRequest, ChatResponse

logger = logging.getLogger("renovation_assistant")

app = FastAPI(title="Renovation Assistant API", version="0.1.0")

_settings = get_settings()
if not _settings.llm_api_key:
    logger.warning("LLM_API_KEY is not set; /chat will fail until it is configured.")

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


def _with_system_prompt(messages: list[ChatMessage]) -> list[ChatMessage]:
    """Ensure the conversation starts with the assistant's system prompt."""
    if messages and messages[0].role == "system":
        return messages
    return [ChatMessage(role="system", content=SYSTEM_PROMPT), *messages]


@app.post("/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    provider: LLMProvider = Depends(get_llm_provider),
) -> ChatResponse:
    """Answer a renovation question (single request/response, no streaming yet)."""
    messages = _with_system_prompt(request.messages)
    try:
        reply = await provider.chat(messages)
    except Exception as exc:  # noqa: BLE001 - surface any upstream failure as 502
        logger.exception("LLM provider call failed")
        raise HTTPException(status_code=502, detail="LLM provider error") from exc
    return ChatResponse(reply=reply)
