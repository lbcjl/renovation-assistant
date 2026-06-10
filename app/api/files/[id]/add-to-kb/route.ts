/**
 * POST /api/files/{id}/add-to-kb — extract, chunk, embed, and index a file.
 *
 * Port of `backend/app/routers/files.py::add_to_knowledge_base`. The shared
 * vector store singleton (lib/rag/factory) is mutated and persisted, so chat
 * retrieval finds the new chunks on the next request without a restart.
 */

import { getSettings } from "@/lib/config";
import { FileService } from "@/lib/file-service";
import { getEmbeddings, getRetriever, replaceVectorStore } from "@/lib/rag/factory";

export const runtime = "nodejs";

const TEST_USER_ID = "default";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  const { id } = await context.params;
  const settings = getSettings();
  const fileService = new FileService(settings.uploadsDir, settings.fileMetadataPath);

  const fileMetadata = fileService.getFile(id, TEST_USER_ID);
  if (!fileMetadata) {
    return Response.json({ detail: "File not found" }, { status: 404 });
  }
  if (fileMetadata.in_knowledge_base) {
    return Response.json({ success: true, message: "File is already in knowledge base" });
  }

  try {
    const [success, message] = await fileService.addToKnowledgeBase(id, TEST_USER_ID, {
      embeddings: getEmbeddings(),
      stores: {
        getStore: () => getRetriever().store,
        replaceStore: replaceVectorStore,
      },
      indexDir: settings.indexDir,
    });
    if (!success) {
      // Client-side errors (unsupported format, empty file, etc.).
      return Response.json({ detail: message }, { status: 400 });
    }
    return Response.json({ success: true, message });
  } catch (error) {
    console.error(`Failed to add file ${id} to knowledge base:`, error);
    // Map provider failures to 502 based on the error message (Python parity).
    const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
    if (text.includes("embedding") || text.includes("provider") || text.includes("api")) {
      return Response.json({ detail: "Embedding provider error" }, { status: 502 });
    }
    return Response.json({ detail: "Failed to add file to knowledge base" }, { status: 500 });
  }
}
