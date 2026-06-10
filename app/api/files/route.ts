/**
 * GET /api/files — list uploaded files.
 *
 * Port of `backend/app/routers/files.py::list_files`.
 */

import { getSettings } from "@/lib/config";
import { FileService } from "@/lib/file-service";

export const runtime = "nodejs";

const TEST_USER_ID = "default";

export async function GET(): Promise<Response> {
  const settings = getSettings();
  const fileService = new FileService(settings.uploadsDir, settings.fileMetadataPath);
  return Response.json({ files: fileService.listFiles(TEST_USER_ID) });
}
