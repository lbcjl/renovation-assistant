"""Application settings loaded from environment variables / .env file."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend configuration.

    Values are read from environment variables (case-insensitive) or a local
    ``.env`` file. See ``.env.example`` for the full list.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM provider (OpenAI-compatible). Defaults target DeepSeek. ---
    llm_provider: str = "deepseek"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.deepseek.com"
    llm_model: str = "deepseek-chat"

    # Request timeout (seconds) applied to LLM chat calls.
    request_timeout_seconds: float = 60.0

    # --- Image generation provider (OpenAI-compatible). ---
    image_api_key: str = ""
    image_base_url: str = "https://freeapi.dgbmc.top/v1"
    image_model: str = "gpt-image-2"

    # --- Embedding provider (OpenAI-compatible /embeddings). ---
    # Defaults target SiliconFlow hosting BAAI/bge-m3 (strong Chinese retrieval).
    # NOTE: DeepSeek has no embeddings endpoint, so this needs its own key.
    embedding_api_key: str = ""
    embedding_base_url: str = "https://api.siliconflow.cn/v1"
    embedding_model: str = "BAAI/bge-m3"

    # --- Retrieval (RAG) ---
    retrieval_top_k: int = 4
    retrieval_min_score: float = 0.5
    knowledge_dir: str = "data/knowledge"
    index_dir: str = "data/index"

    # --- CORS ---
    cors_origins: str = "http://localhost:5173"

    # --- Authentication (JWT) ---
    jwt_secret_key: str = "dev-secret-change-in-production-min-32-chars"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7

    # --- Database ---
    database_path: str = "data/database.db"

    @property
    def cors_origin_list(self) -> list[str]:
        """Parse ``cors_origins`` into a clean list of origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()
