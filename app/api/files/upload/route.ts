/**
 * POST /api/files/upload — multipart file upload ("file" field).
 *
 * Port of `backend/app/routers/files.py::upload_file`. Validation failures
 * (type, size, filename) return 400 with the service's message.
 */

import { getSettings } from "@/lib/config";
import { FileService, FileValidationError } from "@/lib/file-service";

export const runtime = "nodejs";

const TEST_USER_ID = "default";

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ detail: "Invalid multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ detail: "File is required" }, { status: 400 });
  }
  if (!file.name) {
    return Response.json({ detail: "Filename is required" }, { status: 400 });
  }
  if (!file.type) {
    return Response.json({ detail: "Content type is required" }, { status: 400 });
  }

  let content: Buffer;
  try {
    content = Buffer.from(await file.arrayBuffer());
  } catch (error) {
    console.error("Failed to read uploaded file:", error);
    return Response.json({ detail: "Failed to read file" }, { status: 400 });
  }

  const settings = getSettings();
  const fileService = new FileService(settings.uploadsDir, settings.fileMetadataPath);
  try {
    const metadata = await fileService.saveFile({
      filename: file.name,
      content,
      contentType: file.type,
      userId: TEST_USER_ID,
    });
    return Response.json({ file: metadata }, { status: 201 });
  } catch (error) {
    // Validation errors (file type, size) -> 400; anything else -> 500.
    if (error instanceof FileValidationError) {
      return Response.json({ detail: error.message }, { status: 400 });
    }
    console.error("Failed to save file:", error);
    return Response.json({ detail: "Failed to save file" }, { status: 500 });
  }
}
