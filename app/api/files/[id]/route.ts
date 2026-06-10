/**
 * DELETE /api/files/{id} — delete an uploaded file and its metadata.
 *
 * Port of `backend/app/routers/files.py::delete_file` (204 on success,
 * 404 when not found).
 */

import { getSettings } from "@/lib/config";
import { FileService } from "@/lib/file-service";

export const runtime = "nodejs";

const TEST_USER_ID = "default";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const settings = getSettings();
  const fileService = new FileService(settings.uploadsDir, settings.fileMetadataPath);
  if (!fileService.deleteFile(id, TEST_USER_ID)) {
    return Response.json({ detail: "File not found" }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
