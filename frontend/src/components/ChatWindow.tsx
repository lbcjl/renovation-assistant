import { useState, useEffect, type KeyboardEvent } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamChat } from '../api/chat'
import { listFiles, deleteFile, addToKnowledgeBase } from '../api/files'
import type { ChatMessage, FileMetadata } from '../types'
import { FileCard } from './FileCard'
import { FileUpload } from './FileUpload'

const SUGGESTIONS = [
  '卫生间防水要刷多高？',
  '先做水电还是先贴砖？',
  '半包和全包有什么区别？',
  '厨房台面用什么材质好？',
]

function patchLast(
  messages: ChatMessage[],
  patch: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  if (messages.length === 0) {
    return messages
  }
  const next = messages.slice()
  next[next.length - 1] = patch(next[next.length - 1])
  return next
}

interface ChatWindowProps {
  onAuthError: () => void
}

export function ChatWindow({ onAuthError }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<FileMetadata[]>([])
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Load files on mount
  useEffect(() => {
    void loadFiles()
  }, [])

  async function loadFiles(): Promise<void> {
    try {
      const fileList = await listFiles()
      setFiles(fileList)
    } catch (err) {
      // Silently fail - files are optional
      console.error('Failed to load files:', err)
    }
  }

  async function handleUploadSuccess(file: FileMetadata): Promise<void> {
    setFiles((prev) => [...prev, file])
    setUploadError(null)
  }

  function handleUploadError(errorMessage: string): void {
    setUploadError(errorMessage)
    setTimeout(() => setUploadError(null), 5000)
  }

  async function handleDeleteFile(fileId: string): Promise<void> {
    try {
      await deleteFile(fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除失败'
      setUploadError(errorMessage)
      setTimeout(() => setUploadError(null), 5000)
    }
  }

  async function handleAddToKb(fileId: string): Promise<void> {
    try {
      await addToKnowledgeBase(fileId)
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, in_knowledge_base: true } : f)),
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '操作失败'
      setUploadError(errorMessage)
      setTimeout(() => setUploadError(null), 5000)
    }
  }

  async function submit(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || loading) {
      return
    }

    const history: ChatMessage[] = [...messages, { role: 'user', content: trimmed }]
    setMessages([...history, { role: 'assistant', content: '', sources: [] }])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      await streamChat(history, {
        onSources: (sources) =>
          setMessages((prev) => patchLast(prev, (message) => ({ ...message, sources }))),
        onDelta: (delta) =>
          setMessages((prev) =>
            patchLast(prev, (message) => ({ ...message, content: message.content + delta })),
          ),
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '出错了，请稍后重试'

      // Handle auth errors specifically
      if (errorMessage.includes('登录') || errorMessage.includes('未登录')) {
        setError(errorMessage)
        // Trigger logout after a delay
        setTimeout(() => {
          onAuthError()
        }, 2000)
      } else {
        setError(errorMessage)
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1]
        return last && last.role === 'assistant' && last.content === '' ? prev.slice(0, -1) : prev
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit(input)
    }
  }

  return (
    <div className="chat">
      {/* File list section */}
      {files.length > 0 && (
        <div className="chat__files">
          <div className="chat__files-header">已上传文件 ({files.length})</div>
          <div className="chat__files-grid">
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                onDelete={handleDeleteFile}
                onAddToKb={handleAddToKb}
              />
            ))}
          </div>
        </div>
      )}

      <div className="chat__messages">
        {messages.length === 0 ? (
          <div className="chat__empty">
            <p className="chat__empty-title">你好，我是装修小助手</p>
            <p className="chat__empty-sub">
              选材、报价、施工顺序、避坑……装修问题都可以问我，回答会标注知识库依据。
            </p>
            <div className="chat__suggestions">
              {SUGGESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="chat__chip"
                  onClick={() => void submit(question)}
                  disabled={loading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => {
            const isStreaming =
              loading && index === messages.length - 1 && message.role === 'assistant'
            return (
              <div key={index} className={`chat__row chat__row--${message.role}`}>
                <div className="chat__bubble">
                  {message.role === 'user' ? (
                    message.content
                  ) : message.content ? (
                    <div className="chat__md">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
                    </div>
                  ) : isStreaming ? (
                    <span className="chat__typing" role="status" aria-label="思考中">
                      <span />
                      <span />
                      <span />
                    </span>
                  ) : (
                    ''
                  )}
                  {message.sources && message.sources.length > 0 && (
                    <div className="chat__sources">
                      <span className="chat__sources-label">依据</span>
                      {message.sources.map((source) => (
                        <span key={source.source} className="chat__source">
                          {source.source}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {error && <p className="chat__error">{error}</p>}
      {uploadError && <p className="chat__error">{uploadError}</p>}

      <div className="chat__input">
        <FileUpload
          onUploadSuccess={handleUploadSuccess}
          onUploadError={handleUploadError}
          disabled={loading}
        />
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入装修问题，回车发送（Shift+Enter 换行）"
          rows={2}
        />
        <button
          type="button"
          className="chat__send"
          onClick={() => void submit(input)}
          disabled={loading || input.trim().length === 0}
          aria-label="发送"
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
            <path d="M12 19V5" />
            <path d="m5 12 7-7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
