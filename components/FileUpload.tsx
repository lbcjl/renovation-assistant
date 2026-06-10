"use client";

import { useRef, type ChangeEvent } from "react";

import { uploadFile, type FileMetadata } from "@/lib/api-client";

interface FileUploadProps {
  onUploadSuccess: (file: FileMetadata) => void;
  onUploadError: (error: string) => void;
  disabled?: boolean;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

const ALLOWED_EXTENSIONS = ".jpg,.jpeg,.png,.webp,.pdf,.docx,.xlsx,.csv";

const FILE_SIZE_LIMITS: Record<string, number> = {
  image: 10 * 1024 * 1024, // 10MB
  document: 20 * 1024 * 1024, // 20MB
  table: 10 * 1024 * 1024, // 10MB
};

function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (
    mimeType === "application/pdf" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "document";
  }
  return "table";
}

function validateFile(file: File): string | null {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return `不支持的文件类型: ${file.type}`;
  }

  // Check file size
  const category = getFileCategory(file.type);
  const limit = FILE_SIZE_LIMITS[category];
  if (file.size > limit) {
    const limitMB = limit / (1024 * 1024);
    return `文件过大: ${(file.size / (1024 * 1024)).toFixed(1)}MB 超过 ${limitMB}MB 限制`;
  }

  return null;
}

export function FileUpload({ onUploadSuccess, onUploadError, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick(): void {
    inputRef.current?.click();
  }

  async function handleChange(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    // Process each file
    for (const file of Array.from(files)) {
      // Validate file
      const error = validateFile(file);
      if (error) {
        onUploadError(error);
        continue;
      }

      // Upload file
      try {
        const metadata = await uploadFile(file);
        onUploadSuccess(metadata);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "上传失败";
        onUploadError(errorMessage);
      }
    }

    // Reset input to allow uploading the same file again
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS}
        multiple
        onChange={(e) => void handleChange(e)}
        style={{ display: "none" }}
      />
      <button
        type="button"
        className="chat__upload"
        onClick={handleClick}
        disabled={disabled}
        title="上传文件"
        aria-label="上传文件"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      </button>
    </>
  );
}
