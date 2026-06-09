"""Tests for markdown chunking."""

from app.rag.chunking import chunk_markdown


def test_chunk_splits_on_h2_and_skips_title() -> None:
    text = "# 标题\n\n## 问题一\n答案一\n\n## 问题二\n答案二\n"
    chunks = chunk_markdown(text, "doc")
    texts = [chunk for chunk, _ in chunks]
    sources = [source for _, source in chunks]
    assert len(chunks) == 2
    assert "问题一" in texts[0] and "答案一" in texts[0]
    assert "标题" not in "\n".join(texts)  # the H1 title line is skipped
    assert sources[0] == "doc · 问题一"


def test_chunk_handles_no_headings() -> None:
    chunks = chunk_markdown("一段普通文字\n第二行", "doc")
    assert len(chunks) == 1
    assert chunks[0][1] == "doc"


def test_chunk_long_section_is_split() -> None:
    long_body = "\n\n".join(["段落内容" * 60 for _ in range(5)])  # well over 800 chars
    chunks = chunk_markdown(f"## 长节\n{long_body}", "doc")
    assert len(chunks) >= 2
