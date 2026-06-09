"""Tests for the streaming /chat/stream endpoint (SSE), using fakes (no network)."""

import json

from fastapi.testclient import TestClient

from tests.conftest import FakeProvider


def _parse_sse(body: str) -> list[tuple[str | None, dict]]:
    """Parse an SSE body into (event, data) pairs."""
    events: list[tuple[str | None, dict]] = []
    for block in body.strip().split("\n\n"):
        if not block.strip():
            continue
        event: str | None = None
        data: str | None = None
        for line in block.splitlines():
            if line.startswith("event:"):
                event = line[len("event:") :].strip()
            elif line.startswith("data:"):
                data = line[len("data:") :].strip()
        events.append((event, json.loads(data) if data else {}))
    return events


def test_chat_stream_emits_sources_deltas_done(
    client_with_index: TestClient, fake_provider: FakeProvider
) -> None:
    response = client_with_index.post(
        "/chat/stream", json={"messages": [{"role": "user", "content": "卫生间防水要刷多高"}]}
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = _parse_sse(response.text)
    kinds = [event for event, _ in events]

    # First event carries the cited sources; stream ends with `done`.
    assert kinds[0] == "sources"
    assert "done" in kinds
    assert any("防水" in src["source"] for src in events[0][1]["sources"])

    # Concatenated deltas reconstruct the reply.
    deltas = "".join(data["delta"] for event, data in events if event is None and "delta" in data)
    assert deltas == "测试回复"
    # System prompt was injected with the retrieved doc.
    assert fake_provider.received is not None
    assert fake_provider.received[0].role == "system"
