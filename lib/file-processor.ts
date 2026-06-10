/**
 * Extract text content from various file types for RAG ingestion.
 *
 * Port of `backend/app/services/file_processor.py`:
 * pypdf -> unpdf, python-docx -> mammoth, openpyxl/csv -> xlsx package.
 * txt/md are read as UTF-8 (new in the Next.js migration); images remain a
 * placeholder until OCR / vision integration.
 */

import fs from "node:fs";
import path from "node:path";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import * as XLSX from "xlsx";

/** The file's MIME type has no extraction support (maps to a client error). */
export class UnsupportedFileTypeError extends Error {}

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

async function extractTextFromPdf(filePath: string): Promise<string> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const parts: string[] = [];
    text.forEach((pageText, index) => {
      if (pageText.trim()) {
        parts.push(`[Page ${index + 1}]\n${pageText.trim()}`);
      }
    });
    if (parts.length === 0) {
      console.warn(`No text extracted from PDF: ${filePath}`);
      return "";
    }
    return parts.join("\n\n");
  } catch (error) {
    throw new Error(
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function extractTextFromDocx(filePath: string): Promise<string> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const result = await mammoth.extractRawText({ buffer });
    const paragraphs = result.value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (paragraphs.length === 0) {
      console.warn(`No text extracted from DOCX: ${filePath}`);
      return "";
    }
    return paragraphs.join("\n\n");
  } catch (error) {
    throw new Error(
      `DOCX extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function sheetRows(sheet: XLSX.WorkSheet): string[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const lines: string[] = [];
  for (const row of rows) {
    const values = row.map((cell) => (cell === null || cell === undefined ? "" : String(cell)));
    if (values.some((value) => value.trim())) {
      lines.push(values.join(" | "));
    }
  }
  return lines;
}

async function extractTextFromExcel(filePath: string): Promise<string> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetContents: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const lines = sheetRows(workbook.Sheets[sheetName]);
      if (lines.length > 0) {
        sheetContents.push(`[Sheet: ${sheetName}]\n${lines.join("\n")}`);
      }
    }
    if (sheetContents.length === 0) {
      console.warn(`No data extracted from Excel: ${filePath}`);
      return "";
    }
    return sheetContents.join("\n\n");
  } catch (error) {
    throw new Error(
      `Excel extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function extractTextFromCsv(filePath: string): Promise<string> {
  try {
    const buffer = await fs.promises.readFile(filePath);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const lines = firstSheet ? sheetRows(firstSheet) : [];
    if (lines.length === 0) {
      console.warn(`No data extracted from CSV: ${filePath}`);
      return "";
    }
    return lines.join("\n");
  } catch (error) {
    throw new Error(
      `CSV extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

async function extractTextFromPlainText(filePath: string): Promise<string> {
  try {
    return await fs.promises.readFile(filePath, "utf-8");
  } catch (error) {
    throw new Error(
      `Text extraction failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function extractTextFromImage(filePath: string): string {
  // Placeholder until OCR or a vision model is integrated (same as Python).
  return (
    `[Image: ${path.basename(filePath)}]\n` +
    "Image content processing requires OCR or vision model integration."
  );
}

/**
 * Extract text content from a file based on its MIME type.
 *
 * @throws UnsupportedFileTypeError If the file type is not supported.
 * @throws Error If extraction fails.
 */
export async function extractFileContent(filePath: string, fileType: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  if (fileType === "application/pdf") {
    return extractTextFromPdf(filePath);
  }
  if (fileType === DOCX_MIME) {
    return extractTextFromDocx(filePath);
  }
  if (fileType === XLSX_MIME) {
    return extractTextFromExcel(filePath);
  }
  if (fileType === "text/csv") {
    return extractTextFromCsv(filePath);
  }
  if (fileType === "text/plain" || fileType === "text/markdown") {
    return extractTextFromPlainText(filePath);
  }
  if (fileType.startsWith("image/")) {
    return extractTextFromImage(filePath);
  }
  throw new UnsupportedFileTypeError(`Unsupported file type for content extraction: ${fileType}`);
}
