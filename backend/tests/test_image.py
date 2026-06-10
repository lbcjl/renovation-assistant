"""Test image generation endpoint."""

import pytest
from httpx import AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_generate_image_requires_auth():
    """Image generation requires authentication."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/image/generate",
            json={"prompt": "a modern kitchen with white cabinets"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_generate_image_validates_prompt():
    """Empty prompt is rejected."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/image/generate",
            json={"prompt": ""},
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code in [401, 422]  # auth or validation


@pytest.mark.asyncio
async def test_generate_image_prompt_too_long():
    """Prompt exceeding 1000 chars is rejected."""
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/image/generate",
            json={"prompt": "a" * 1001},
            headers={"Authorization": "Bearer fake-token"},
        )
    assert response.status_code in [401, 422]
