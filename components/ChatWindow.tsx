"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useState, type KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { addToKnowledgeBase, deleteFile, listFiles, type FileMetadata } from "@/lib/api-client";
import { messageSources, messageText, type ChatUIMessage } from "@/lib/chat";

import { FileCard } from "./FileCard";
import { FileUpload } from "./FileUpload";

const SUGGESTIONS = [
  "卫生间防水要刷多高？",
  "先做水电还是先贴砖？",
  "半包和全包有什么区别？",
  "厨房台面用什么材质好？",
];

/** Map transport/stream errors to a friendly Chinese message for the error line. */
function friendlyChatError(error: Error): string {
  // The server masks provider failures as "LLM provider error" (stream error part).
  if (error.message.includes("LLM provider error")) {
    return "LLM 服务出错，请稍后重试";
  }
  // fetch() network failures (server unreachable) surface as TypeError.
  if (error instanceof TypeError) {
    return "无法连接服务器，请稍后重试";
  }
  return "出错了，请稍后重试";
}

export function ChatWindow() {
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { messages, sendMessage, status } = useChat<ChatUIMessage>({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (chatError) => {
      console.error("Chat request failed:", chatError);
      setError(friendlyChatError(chatError));
    },
  });
  const loading = status === "submitted" || status === "streaming";

  // Load files on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const fileList = await listFiles();
        if (!cancelled) {
          setFiles(fileList);
        }
      } catch (err) {
        // Silently fail - files are optional.
        console.error("Failed to load files:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function handleUploadSuccess(file: FileMetadata): void {
    setFiles((prev) => [...prev, file]);
    setUploadError(null);
  }

  function handleUploadError(errorMessage: string): void {
    setUploadError(errorMessage);
    setTimeout(() => setUploadError(null), 5000);
  }

  async function handleDeleteFile(fileId: string): Promise<void> {
    try {
      await deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "删除失败";
      setUploadError(errorMessage);
      setTimeout(() => setUploadError(null), 5000);
    }
  }

  async function handleAddToKb(fileId: string): Promise<void> {
    try {
      await addToKnowledgeBase(fileId);
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, in_knowledge_base: true } : f)),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "操作失败";
      setUploadError(errorMessage);
      setTimeout(() => setUploadError(null), 5000);
    }
  }

  function submit(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || loading) {
      return;
    }
    setInput("");
    setError(null);
    void sendMessage({ text: trimmed });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit(input);
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
                  onClick={() => submit(question)}
                  disabled={loading}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const text = messageText(message);
              const sources = message.role === "assistant" ? messageSources(message) : [];
              const isStreaming =
                loading && index === messages.length - 1 && message.role === "assistant";
              // Drop assistant bubbles that errored before any text arrived
              // (parity with the old UI removing the empty placeholder).
              if (message.role === "assistant" && !text && !isStreaming) {
                return null;
              }
              return (
                <div key={message.id} className={`chat__row chat__row--${message.role}`}>
                  <div className="chat__bubble">
                    {message.role === "user" ? (
                      text
                    ) : text ? (
                      <div className="chat__md">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                      </div>
                    ) : (
                      <span className="chat__typing" role="status" aria-label="思考中">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                    {sources.length > 0 && (
                      <div className="chat__sources">
                        <span className="chat__sources-label">依据</span>
                        {sources.map((source) => (
                          <span key={source.source} className="chat__source">
                            {source.source}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {/* Typing indicator while waiting for the stream to start. */}
            {status === "submitted" && (
              <div className="chat__row chat__row--assistant">
                <div className="chat__bubble">
                  <span className="chat__typing" role="status" aria-label="思考中">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              </div>
            )}
          </>
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
          onClick={() => submit(input)}
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
  );
}
