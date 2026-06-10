"""Runtime provider configuration: editable from the settings page, persisted to JSON.

One file (``data/provider_config.json``) stores per-provider sections::

    {"llm": {"base_url": ..., "api_key": ..., "model": ...}, "image": {...}}

Saved values override the ``.env`` defaults so the relay base URL / API key /
model for both chat and image generation can be changed from the UI without a
restart. The file stores API keys in plain text, same as ``.env``; both are
local, git-ignored files.
"""

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from app.config import Settings

logger = logging.getLogger(__name__)

# Relative to the backend working directory, alongside the other data files.
CONFIG_PATH = Path("data/provider_config.json")

ProviderSection = Literal["llm", "image"]


@dataclass(frozen=True)
class ProviderConfig:
    """Effective connection settings for one provider (file overrides .env)."""

    base_url: str
    api_key: str
    model: str


def _env_defaults(section: ProviderSection, settings: Settings) -> ProviderConfig:
    if section == "llm":
        return ProviderConfig(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key,
            model=settings.llm_model,
        )
    return ProviderConfig(
        base_url=settings.image_base_url,
        api_key=settings.image_api_key,
        model=settings.image_model,
    )


def _read_file(path: Path) -> dict:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return raw if isinstance(raw, dict) else {}
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        logger.warning("Ignoring unreadable provider config file: %s", path)
        return {}


def load_provider_config(
    section: ProviderSection, settings: Settings, path: Path | None = None
) -> ProviderConfig:
    """Return the saved runtime config for a provider, falling back to .env."""
    defaults = _env_defaults(section, settings)
    raw_section = _read_file(path or CONFIG_PATH).get(section)
    if not isinstance(raw_section, dict):
        return defaults
    overrides = {key: value for key, value in raw_section.items() if isinstance(value, str)}
    return ProviderConfig(
        base_url=overrides.get("base_url") or defaults.base_url,
        api_key=overrides.get("api_key") or defaults.api_key,
        model=overrides.get("model") or defaults.model,
    )


def save_provider_config(
    section: ProviderSection, config: ProviderConfig, path: Path | None = None
) -> None:
    """Persist one provider's runtime config, keeping other sections intact."""
    config_path = path or CONFIG_PATH
    data = _read_file(config_path)
    data[section] = {
        "base_url": config.base_url,
        "api_key": config.api_key,
        "model": config.model,
    }
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def mask_api_key(key: str) -> str:
    """Return a display-safe preview of an API key (never the full value)."""
    if not key:
        return ""
    if len(key) <= 12:
        return "***"
    return f"{key[:6]}...{key[-4:]}"
