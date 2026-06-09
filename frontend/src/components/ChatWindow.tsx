import { useState, type KeyboardEvent } from 'react'
import { streamChat } from '../api/chat'
import type { ChatMessage } from '../types'

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

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      setError(err instanceof Error ? err.message : '出错了，请稍后重试')
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
                  {message.content ? (
                    message.content
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

      <div className="chat__input">
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
