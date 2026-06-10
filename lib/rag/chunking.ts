/**
 * Split markdown knowledge documents into retrievable chunks.
 *
 * Port of `backend/app/rag/chunking.py` — the logic is kept identical.
 * Seed documents are authored as Q&A sections under `## ` headings, so each
 * section becomes one chunk (further split if a section is very long).
 */

const MAX_CHARS = 800;

/** A chunk of text plus its source label. */
export type Chunk = [text: string, sourceLabel: string];

/** Split markdown into `[chunkText, sourceLabel]` pairs. */
export function chunkMarkdown(text: string, source: string): Chunk[] {
  const chunks: Chunk[] = [];
  for (const [heading, body] of splitByH2(text)) {
    const content = heading ? `${heading}\n${body}`.trim() : body.trim();
    if (!content) {
      continue;
    }
    const label = heading ? `${source} · ${heading}` : source;
    for (const piece of splitLong(content)) {
      chunks.push([piece, label]);
    }
  }
  return chunks;
}

function splitByH2(text: string): Array<[heading: string, body: string]> {
  const sections: Array<[string, string]> = [];
  let heading = "";
  let buffer: string[] = [];
  for (const line of text.split(/\r\n|\r|\n/)) {
    if (line.startsWith("## ")) {
      if (heading || buffer.length > 0) {
        sections.push([heading, buffer.join("\n").trim()]);
      }
      heading = line.slice(3).trim();
      buffer = [];
    } else if (line.startsWith("# ")) {
      continue; // skip the document title line
    } else {
      buffer.push(line);
    }
  }
  if (heading || buffer.length > 0) {
    sections.push([heading, buffer.join("\n").trim()]);
  }
  return sections;
}

function splitLong(content: string): string[] {
  if (content.length <= MAX_CHARS) {
    return [content];
  }
  const parts: string[] = [];
  let current = "";
  const paragraphs = content
    .split("\n\n")
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
  for (const paragraph of paragraphs) {
    if (current && current.length + paragraph.length + 2 > MAX_CHARS) {
      parts.push(current.trim());
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}
