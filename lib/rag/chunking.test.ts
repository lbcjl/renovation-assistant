/**
 * Tests for markdown chunking.
 *
 * Ports `backend/tests/test_chunking.py`.
 */

import { describe, expect, it } from "vitest";

import { chunkMarkdown } from "@/lib/rag/chunking";

describe("chunkMarkdown", () => {
  it("splits on H2 headings and skips the H1 title", () => {
    const text = "# 标题\n\n## 问题一\n答案一\n\n## 问题二\n答案二\n";
    const chunks = chunkMarkdown(text, "doc");
    const texts = chunks.map(([chunk]) => chunk);
    const sources = chunks.map(([, source]) => source);

    expect(chunks).toHaveLength(2);
    expect(texts[0]).toContain("问题一");
    expect(texts[0]).toContain("答案一");
    expect(texts.join("\n")).not.toContain("标题"); // the H1 title line is skipped
    expect(sources[0]).toBe("doc · 问题一");
  });

  it("handles documents without headings", () => {
    const chunks = chunkMarkdown("一段普通文字\n第二行", "doc");
    expect(chunks).toHaveLength(1);
    expect(chunks[0][1]).toBe("doc");
  });

  it("splits a long section into multiple chunks", () => {
    const longBody = Array.from({ length: 5 }, () => "段落内容".repeat(60)).join("\n\n"); // well over 800 chars
    const chunks = chunkMarkdown(`## 长节\n${longBody}`, "doc");
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });
});
