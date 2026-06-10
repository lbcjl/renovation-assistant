"""Request/response schemas for the API."""

from pydantic import BaseModel, Field, field_validator

# Guard rails on incoming requests (size limits; cheap abuse/injection mitigation).
_MAX_MESSAGES = 40
_MAX_MESSAGE_CHARS = 4000


class ChatMessage(BaseModel):
    """A single message in a chat conversation."""

    role: str = Field(..., description="One of: system, user, assistant.")
    content: str = Field(..., min_length=1)


class ChatRequest(BaseModel):
    """Payload for the chat endpoints."""

    messages: list[ChatMessage] = Field(..., min_length=1, max_length=_MAX_MESSAGES)
    # Optional override of the server-configured chat model (e.g. picked from
    # GET /models). None means "use the configured default".
    model: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("messages")
    @classmethod
    def _limit_message_size(cls, messages: list[ChatMessage]) -> list[ChatMessage]:
        # Only validates incoming client messages; the server-built system
        # message is constructed separately and is not subject to this cap.
        for message in messages:
            if len(message.content) > _MAX_MESSAGE_CHARS:
                raise ValueError(f"message content exceeds {_MAX_MESSAGE_CHARS} characters")
        return messages


class Source(BaseModel):
    """A knowledge-base source used to ground an answer."""

    source: str
    score: float


class ChatResponse(BaseModel):
    """Response from the /chat endpoint."""

    reply: str
    sources: list[Source] = Field(default_factory=list)


# --- Authentication schemas ---


class LoginRequest(BaseModel):
    """Payload for the /auth/login endpoint."""

    username: str = Field(..., min_length=1, max_length=50)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    """Response from the /auth/login endpoint."""

    access_token: str
    token_type: str = "bearer"
    username: str


class UserResponse(BaseModel):
    """Response from the /auth/me endpoint."""

    username: str
    is_active: bool


# --- File upload schemas ---


class FileMetadata(BaseModel):
    """Metadata for an uploaded file."""

    id: str
    filename: str
    original_name: str
    type: str
    size: int
    path: str
    uploaded_at: str
    in_knowledge_base: bool = False
    user_id: str = "default"


class FileListResponse(BaseModel):
    """Response from the /api/files endpoint."""

    files: list[FileMetadata]


class FileUploadResponse(BaseModel):
    """Response from the /api/upload endpoint."""

    file: FileMetadata


class AddToKnowledgeBaseResponse(BaseModel):
    """Response from the /api/files/{file_id}/add-to-kb endpoint."""

    success: bool
    message: str


# --- Image generation schemas ---


class ImageGenerationRequest(BaseModel):
    """Payload for the /image/generate endpoint."""

    prompt: str = Field(..., min_length=1, max_length=1000)


class ImageGenerationResponse(BaseModel):
    """Response from the /image/generate endpoint."""

    image_url: str


# --- Provider settings schemas (chat LLM and image generation) ---


class ModelListResponse(BaseModel):
    """Response from the POST /settings/{provider}/models endpoint."""

    models: list[str]
    default: str


class ProviderSettingsResponse(BaseModel):
    """Response from the GET /settings/{provider} endpoint (API key is masked)."""

    base_url: str
    model: str
    api_key_set: bool
    api_key_preview: str


class ProviderSettingsUpdateRequest(BaseModel):
    """Payload for the PUT /settings/{provider} endpoint.

    ``api_key`` left empty/None keeps the currently saved key.
    """

    base_url: str = Field(..., min_length=1, max_length=500, pattern=r"^https?://")
    model: str = Field(..., min_length=1, max_length=100)
    api_key: str | None = Field(default=None, max_length=500)


class FetchModelsRequest(BaseModel):
    """Payload for the POST /settings/{provider}/models endpoint.

    Empty fields fall back to the currently saved configuration, so the page
    can probe a new base URL / key before saving.
    """

    base_url: str | None = Field(default=None, max_length=500)
    api_key: str | None = Field(default=None, max_length=500)
