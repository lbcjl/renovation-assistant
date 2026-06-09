"""Request/response schemas for the API."""

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., description="One of: system, user, assistant.")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    """Payload for the /chat endpoint."""

    messages: list[ChatMessage] = Field(..., min_length=1)


class Source(BaseModel):
    """A knowledge-base source used to ground an answer."""

    source: str
    score: float


class ChatResponse(BaseModel):
    """Response from the /chat endpoint."""

    reply: str
    sources: list[Source] = Field(default_factory=list)
