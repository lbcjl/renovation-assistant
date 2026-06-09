"""File management service: upload, list, delete, metadata storage."""

import json
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from app.rag.embeddings import EmbeddingProvider
from app.rag.store import VectorStore
from app.schemas import FileMetadata

logger = logging.getLogger("renovation_assistant")

# File size limits in bytes
FILE_SIZE_LIMITS = {
    "image": 10 * 1024 * 1024,  # 10MB
    "document": 20 * 1024 * 1024,  # 20MB
    "table": 10 * 1024 * 1024,  # 10MB
}

# Allowed file types
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf", ".docx", ".xlsx", ".csv"}


def _get_file_category(mime_type: str) -> str:
    """Map MIME type to category for size limit checking."""
    if mime_type.startswith("image/"):
        return "image"
    if mime_type in {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }:
        return "document"
    if mime_type in {
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
    }:
        return "table"
    return "document"  # default


class FileService:
    """Manages file uploads and metadata persistence."""

    def __init__(self, upload_dir: Path, metadata_file: Path) -> None:
        self.upload_dir = upload_dir
        self.metadata_file = metadata_file
        self._ensure_directories()

    def _ensure_directories(self) -> None:
        """Create upload directory and metadata file if they don't exist."""
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        if not self.metadata_file.exists():
            self._save_metadata({"files": []})

    def _load_metadata(self) -> dict[str, list[dict]]:
        """Load file metadata from JSON."""
        try:
            with self.metadata_file.open("r", encoding="utf-8") as file:
                return json.load(file)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"files": []}

    def _save_metadata(self, data: dict[str, list[dict]]) -> None:
        """Save file metadata to JSON."""
        with self.metadata_file.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)

    def validate_file(self, filename: str, content_type: str, size: int) -> None:
        """Validate file type and size.

        Raises:
            ValueError: If file type or size is invalid.
        """
        # Prevent path traversal in filename
        if "/" in filename or "\\" in filename or ".." in filename:
            raise ValueError("Filename cannot contain path separators or '..'")

        # Check file extension
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(
                f"Unsupported file type: {ext}. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )

        # Check MIME type
        if content_type not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Unsupported MIME type: {content_type}")

        # Check file size
        category = _get_file_category(content_type)
        limit = FILE_SIZE_LIMITS[category]
        if size > limit:
            limit_mb = limit / (1024 * 1024)
            raise ValueError(f"File too large: {size} bytes exceeds {limit_mb}MB limit")

    async def save_file(
        self, filename: str, content: bytes, content_type: str, user_id: str = "default"
    ) -> FileMetadata:
        """Save uploaded file and create metadata entry.

        Args:
            filename: Original filename.
            content: File content bytes.
            content_type: MIME type.
            user_id: User identifier.

        Returns:
            FileMetadata for the saved file.

        Raises:
            ValueError: If file validation fails.
        """
        # Validate
        self.validate_file(filename, content_type, len(content))

        # Generate unique filename
        file_id = str(uuid.uuid4())
        ext = Path(filename).suffix
        timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
        unique_filename = f"{timestamp}_{file_id}{ext}"
        file_path = self.upload_dir / unique_filename

        # Save file to disk
        with file_path.open("wb") as file:
            file.write(content)

        logger.info(
            "Saved file: %s -> %s (%d bytes, %s)",
            filename,
            unique_filename,
            len(content),
            content_type,
        )

        # Create relative web-accessible path
        relative_path = f"backend/data/uploads/{unique_filename}"

        # Create metadata
        metadata = FileMetadata(
            id=file_id,
            filename=unique_filename,
            original_name=filename,
            type=content_type,
            size=len(content),
            path=relative_path,
            uploaded_at=datetime.now(UTC).isoformat(),
            in_knowledge_base=False,
            user_id=user_id,
        )

        # Append to metadata file
        data = self._load_metadata()
        data["files"].append(metadata.model_dump())
        self._save_metadata(data)

        return metadata

    def list_files(self, user_id: str = "default") -> list[FileMetadata]:
        """List all files for a user.

        Args:
            user_id: User identifier.

        Returns:
            List of FileMetadata objects.
        """
        data = self._load_metadata()
        files = [
            FileMetadata(**file_data)
            for file_data in data["files"]
            if file_data.get("user_id", "default") == user_id
        ]
        return files

    def get_file(self, file_id: str, user_id: str = "default") -> FileMetadata | None:
        """Get metadata for a specific file.

        Args:
            file_id: File identifier.
            user_id: User identifier.

        Returns:
            FileMetadata or None if not found.
        """
        data = self._load_metadata()
        for file_data in data["files"]:
            if file_data["id"] == file_id and file_data.get("user_id", "default") == user_id:
                return FileMetadata(**file_data)
        return None

    def delete_file(self, file_id: str, user_id: str = "default") -> bool:
        """Delete a file and its metadata.

        Args:
            file_id: File identifier.
            user_id: User identifier.

        Returns:
            True if deleted, False if not found.
        """
        data = self._load_metadata()
        files = data["files"]

        for index, file_data in enumerate(files):
            if file_data["id"] == file_id and file_data.get("user_id", "default") == user_id:
                # Delete physical file - construct path from filename to prevent path traversal
                filename = file_data["filename"]
                file_path = self.upload_dir / filename
                # Verify the path is within upload_dir (prevent path traversal)
                try:
                    file_path = file_path.resolve()
                    if not str(file_path).startswith(str(self.upload_dir.resolve())):
                        logger.warning("Path traversal attempt blocked: %s", filename)
                        return False
                except (ValueError, OSError):
                    logger.warning("Invalid file path: %s", filename)
                    return False

                if file_path.exists():
                    file_path.unlink()
                    logger.info("Deleted file: %s", file_path)

                # Remove from metadata
                files.pop(index)
                self._save_metadata(data)
                return True

        return False

    def mark_in_knowledge_base(self, file_id: str, user_id: str = "default") -> bool:
        """Mark a file as added to knowledge base.

        Args:
            file_id: File identifier.
            user_id: User identifier.

        Returns:
            True if updated, False if not found.
        """
        data = self._load_metadata()
        for file_data in data["files"]:
            if file_data["id"] == file_id and file_data.get("user_id", "default") == user_id:
                file_data["in_knowledge_base"] = True
                self._save_metadata(data)
                logger.info("Marked file %s as in knowledge base", file_id)
                return True
        return False

    async def add_to_knowledge_base(
        self,
        file_id: str,
        user_id: str,
        embeddings_provider: EmbeddingProvider,
        vector_store: VectorStore,
        index_dir: Path,
    ) -> tuple[bool, str]:
        """Extract file content, chunk, embed, and add to RAG knowledge base.

        Args:
            file_id: File identifier.
            user_id: User identifier.
            embeddings_provider: Embedding provider instance.
            vector_store: VectorStore instance.
            index_dir: Path to index directory for persistence.

        Returns:
            Tuple of (success: bool, message: str).
        """
        from app.rag.chunking import chunk_markdown
        from app.rag.store import Document
        from app.services.file_processor import extract_file_content

        # Get file metadata
        file_metadata = self.get_file(file_id, user_id)
        if not file_metadata:
            return False, "File not found"

        # Check if already in knowledge base
        if file_metadata.in_knowledge_base:
            return False, "File is already in knowledge base"

        # Get physical file path
        filename = file_metadata.filename
        file_path = self.upload_dir / filename

        # Verify file exists and path is safe
        try:
            file_path = file_path.resolve()
            if not str(file_path).startswith(str(self.upload_dir.resolve())):
                logger.warning("Path traversal attempt blocked: %s", filename)
                return False, "Invalid file path"
        except (ValueError, OSError):
            logger.warning("Invalid file path: %s", filename)
            return False, "Invalid file path"

        if not file_path.exists():
            logger.warning("Physical file not found: %s", file_path)
            return False, "Physical file not found"

        # Extract content
        try:
            logger.info(
                "Extracting content from %s (%s)", file_metadata.original_name, file_metadata.type
            )
            content = extract_file_content(file_path, file_metadata.type)

            if not content or not content.strip():
                return False, "No text content could be extracted from this file"

        except ValueError as exc:
            logger.warning("Unsupported file type for RAG: %s", file_metadata.type)
            return False, str(exc)
        except Exception as exc:
            logger.exception("Content extraction failed for file %s", file_id)
            return False, f"Content extraction failed: {exc}"

        # Chunk content
        try:
            # Use the same chunking logic as markdown docs
            # Format content as markdown-style for consistent chunking
            formatted_content = f"## {file_metadata.original_name}\n\n{content}"
            chunks = chunk_markdown(formatted_content, f"file:{file_metadata.original_name}")

            if not chunks:
                return False, "Content could not be split into chunks"

            logger.info("Split file into %d chunks", len(chunks))
        except Exception as exc:
            logger.exception("Chunking failed for file %s", file_id)
            return False, f"Chunking failed: {exc}"

        # Generate embeddings
        try:
            chunk_texts = [chunk_text for chunk_text, _ in chunks]
            vectors = await embeddings_provider.embed(chunk_texts)
            logger.info("Generated %d embeddings", len(vectors))
        except Exception as exc:
            logger.exception("Embedding generation failed for file %s", file_id)
            return False, f"Embedding generation failed: {exc}"

        # Create documents
        try:
            documents: list[Document] = []
            for i, (chunk_text, source_label) in enumerate(chunks):
                doc = Document(
                    id=f"file-{file_id}-{i}",
                    text=chunk_text,
                    source=source_label,
                )
                documents.append(doc)
        except Exception as exc:
            logger.exception("Document creation failed for file %s", file_id)
            return False, f"Document creation failed: {exc}"

        # Add to vector store and persist
        try:
            vector_store.add(documents, vectors)
            vector_store.save(index_dir)
            logger.info("Added %d documents to vector store and persisted", len(documents))
        except Exception as exc:
            logger.exception("Vector store update failed for file %s", file_id)
            return False, f"Vector store update failed: {exc}"

        # Mark as in knowledge base
        success = self.mark_in_knowledge_base(file_id, user_id)
        if not success:
            logger.warning("Failed to mark file %s as in knowledge base", file_id)
            return False, "Failed to update file metadata"

        return True, f"Successfully added {len(documents)} chunks to knowledge base"
