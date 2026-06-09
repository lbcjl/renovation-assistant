"""Split markdown knowledge documents into retrievable chunks.

Seed documents are authored as Q&A sections under ``## `` headings, so each
section becomes one chunk (further split if a section is very long).
"""

from __future__ import annotations

_MAX_CHARS = 800


def chunk_markdown(text: str, source: str) -> list[tuple[str, str]]:
    """Split markdown into ``(chunk_text, source_label)`` pairs."""
    chunks: list[tuple[str, str]] = []
    for heading, body in _split_by_h2(text):
        content = f"{heading}\n{body}".strip() if heading else body.strip()
        if not content:
            continue
        label = f"{source} · {heading}" if heading else source
        for piece in _split_long(content):
            chunks.append((piece, label))
    return chunks


def _split_by_h2(text: str) -> list[tuple[str, str]]:
    sections: list[tuple[str, str]] = []
    heading = ""
    buffer: list[str] = []
    for line in text.splitlines():
        if line.startswith("## "):
            if heading or buffer:
                sections.append((heading, "\n".join(buffer).strip()))
            heading = line[3:].strip()
            buffer = []
        elif line.startswith("# "):
            continue  # skip the document title line
        else:
            buffer.append(line)
    if heading or buffer:
        sections.append((heading, "\n".join(buffer).strip()))
    return sections


def _split_long(content: str) -> list[str]:
    if len(content) <= _MAX_CHARS:
        return [content]
    parts: list[str] = []
    current = ""
    for paragraph in (p.strip() for p in content.split("\n\n") if p.strip()):
        if current and len(current) + len(paragraph) + 2 > _MAX_CHARS:
            parts.append(current.strip())
            current = paragraph
        else:
            current = f"{current}\n\n{paragraph}" if current else paragraph
    if current.strip():
        parts.append(current.strip())
    return parts
