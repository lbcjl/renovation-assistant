"""File upload and management endpoints."""

import logging
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.config import get_settings
from app.dependencies import get_current_user
from app.models import User
from app.rag.factory import get_embeddings, get_retriever
from app.schemas import AddToKnowledgeBaseResponse, FileListResponse, FileUploadResponse
from app.services.file_service import FileService

logger = logging.getLogger("renovation_assistant")

router = APIRouter(prefix="/api/files", tags=["files"])


def _get_file_service() -> FileService:
    """Dependency: provide FileService instance."""
    upload_dir = Path("backend/data/uploads")
    metadata_file = Path("backend/data/file_metadata.json")
    return FileService(upload_dir, metadata_file)


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File()],
    user: User = Depends(get_current_user),
    file_service: FileService = Depends(_get_file_service),
) -> FileUploadResponse:
    """Upload a file (image, document, or table).

    Requires authentication.

    Supported types:
    - Images: jpg, png, webp (max 10MB)
    - Documents: pdf, docx (max 20MB)
    - Tables: xlsx, csv (max 10MB)

    Returns:
        File metadata including ID, path, and upload timestamp.

    Raises:
        HTTPException: 400 if file validation fails, 413 if file too large.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    if not file.content_type:
        raise HTTPException(status_code=400, detail="Content type is required")

    # Read file content
    try:
        content = await file.read()
    except Exception as exc:
        logger.exception("Failed to read uploaded file")
        raise HTTPException(status_code=400, detail="Failed to read file") from exc

    # Save file
    try:
        metadata = await file_service.save_file(
            filename=file.filename,
            content=content,
            content_type=file.content_type,
            user_id=user.username,
        )
    except ValueError as exc:
        # Validation errors (file type, size)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Failed to save file")
        raise HTTPException(status_code=500, detail="Failed to save file") from exc

    return FileUploadResponse(file=metadata)


@router.get("", response_model=FileListResponse)
async def list_files(
    user: User = Depends(get_current_user),
    file_service: FileService = Depends(_get_file_service),
) -> FileListResponse:
    """List all uploaded files for the current user.

    Requires authentication.

    Returns:
        List of file metadata entries.
    """
    files = file_service.list_files(user_id=user.username)
    return FileListResponse(files=files)


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    file_id: str,
    user: User = Depends(get_current_user),
    file_service: FileService = Depends(_get_file_service),
) -> None:
    """Delete an uploaded file.

    Requires authentication. Users can only delete their own files.

    Args:
        file_id: The file identifier.

    Raises:
        HTTPException: 404 if file not found.
    """
    success = file_service.delete_file(file_id, user_id=user.username)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")


@router.post("/{file_id}/add-to-kb", response_model=AddToKnowledgeBaseResponse)
async def add_to_knowledge_base(
    file_id: str,
    user: User = Depends(get_current_user),
    file_service: FileService = Depends(_get_file_service),
) -> AddToKnowledgeBaseResponse:
    """Add a file to the RAG knowledge base.

    Extracts content from the file, splits it into chunks, generates embeddings,
    and adds it to the vector store for retrieval.

    Requires authentication. Users can only modify their own files.

    Args:
        file_id: The file identifier.

    Returns:
        Success status and message.

    Raises:
        HTTPException: 404 if file not found, 400 if extraction fails, 502 if provider fails.
    """
    # Check if file exists
    file_metadata = file_service.get_file(file_id, user_id=user.username)
    if not file_metadata:
        raise HTTPException(status_code=404, detail="File not found")

    # Check if already in knowledge base
    if file_metadata.in_knowledge_base:
        return AddToKnowledgeBaseResponse(
            success=True,
            message="File is already in knowledge base",
        )

    # Get dependencies
    try:
        settings = get_settings()
        embeddings_provider = get_embeddings()
        retriever = get_retriever()
        vector_store = retriever.store
        index_dir = Path(settings.index_dir)
    except Exception as exc:
        logger.exception("Failed to initialize RAG dependencies")
        raise HTTPException(
            status_code=500,
            detail="Failed to initialize knowledge base system",
        ) from exc

    # Add to knowledge base
    try:
        success, message = await file_service.add_to_knowledge_base(
            file_id=file_id,
            user_id=user.username,
            embeddings_provider=embeddings_provider,
            vector_store=vector_store,
            index_dir=index_dir,
        )

        if not success:
            # Client-side errors (unsupported format, empty file, etc.)
            raise HTTPException(status_code=400, detail=message)

        logger.info("File %s successfully added to knowledge base: %s", file_id, message)
        return AddToKnowledgeBaseResponse(success=True, message=message)

    except HTTPException:
        # Re-raise HTTPException as-is
        raise
    except Exception as exc:
        # Catch any unexpected errors and map to 502 if they involve upstream services
        logger.exception("Failed to add file %s to knowledge base", file_id)

        # Map provider failures to 502 based on exception type or message
        error_str = str(exc).lower()
        if "embedding" in error_str or "provider" in error_str or "api" in error_str:
            raise HTTPException(
                status_code=502,
                detail="Embedding provider error",
            ) from exc

        # Other failures are internal errors
        raise HTTPException(
            status_code=500,
            detail="Failed to add file to knowledge base",
        ) from exc
