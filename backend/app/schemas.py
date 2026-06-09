"""Request/response schemas for the API."""

from pydantic import BaseModel, Field

# Allowed chat roles for an OpenAI-compatible chat API.
ChatRole = str


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., description="One of: system, user, assistant.")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    """Payload for the /chat endpoint."""

    messages: list[ChatMessage] = Field(..., min_length=1)


class ChatResponse(BaseModel):
    """Response from the /chat endpoint."""

    reply: str
