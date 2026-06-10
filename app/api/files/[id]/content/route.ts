/**
 * GET /api/files/{id}/content — serve the stored file bytes.
 *
 * Replaces the FastAPI static mount at /backend/data/uploads. The metadata
 * `path` field points here, so the UI can keep using `file.path` as the URL.
 */

import fs from "node:fs";

import { getSettings } from "@/lib/config";
import { FileService } from "@/lib/file-service";

export const runtime = "nodejs";

const TEST_USER_ID = "default";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const settings = getSettings();
  const fileService = new FileService(settings.uploadsDir, settings.fileMetadataPath);

  const metadata = fileService.getFile(id, TEST_USER_ID);
  if (!metadata) {
    return Response.json({ detail: "File not found" }, { status: 404 });
  }
  const filePath = fileService.resolveStoredPath(metadata.filename);
  if (filePath === null || !fs.existsSync(filePath)) {
    return Response.json({ detail: "File not found" }, { status: 404 });
  }

  const content = await fs.promises.readFile(filePath);
  return new Response(new Uint8Array(content), {
    headers: {
      "Content-Type": metadata.type || "application/octet-stream",
      "Content-Length": String(content.length),
      // Stored bytes never change for a given id.
      "Cache-Control": "private, max-age=3600",
    },
  });
}
