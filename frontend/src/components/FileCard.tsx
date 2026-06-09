import type { FileMetadata } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface FileCardProps {
  file: FileMetadata
  onDelete: (fileId: string) => Promise<void>
  onAddToKb: (fileId: string) => Promise<void>
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) {
    return '🖼️'
  }
  if (mimeType === 'application/pdf') {
    return '📄'
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return '📝'
  }
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'text/csv'
  ) {
    return '📊'
  }
  return '📎'
}

export function FileCard({ file, onDelete, onAddToKb }: FileCardProps) {
  const isImage = file.type.startsWith('image/')

  return (
    <div className="file-card">
      <div className="file-card__preview">
        {isImage ? (
          <img
            src={`${API_BASE_URL}/${file.path}`}
            alt={file.original_name}
            className="file-card__image"
          />
        ) : (
          <div className="file-card__icon">{getFileIcon(file.type)}</div>
        )}
      </div>
      <div className="file-card__info">
        <div className="file-card__name" title={file.original_name}>
          {file.original_name}
        </div>
        <div className="file-card__meta">{formatFileSize(file.size)}</div>
      </div>
      <div className="file-card__actions">
        {!file.in_knowledge_base && (
          <button
            type="button"
            className="file-card__btn file-card__btn--kb"
            onClick={() => void onAddToKb(file.id)}
            title="加入知识库"
            aria-label="加入知识库"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </button>
        )}
        {file.in_knowledge_base && (
          <span className="file-card__badge" title="已加入知识库">
            ✓
          </span>
        )}
        <button
          type="button"
          className="file-card__btn file-card__btn--delete"
          onClick={() => void onDelete(file.id)}
          title="删除"
          aria-label="删除"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
