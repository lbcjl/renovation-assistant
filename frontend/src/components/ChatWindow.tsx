import { useState, type KeyboardEvent } from 'react'
import { streamChat } from '../api/chat'
import type { ChatMessage } from '../types'

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

  async function handleSend(): Promise<void> {
    const text = input.trim()
    if (!text || loading) {
      return
    }

    const history: ChatMessage[] = [...messages, { role: 'user', content: text }]
    // Append an empty assistant bubble that fills in as deltas stream.
    setMessages([...history, { role: 'assistant', content: '', sources: [] }])
    setInput('')
    setError(null)
    setLoading(true)

    try {
      await streamChat(history, {
        onSources: (sources) => {
          setMessages((prev) => patchLast(prev, (message) => ({ ...message, sources })))
        },
        onDelta: (delta) => {
          setMessages((prev) =>
            patchLast(prev, (message) => ({ ...message, content: message.content + delta })),
          )
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请稍后重试')
      // Drop the empty assistant bubble if nothing streamed in.
      setMessages((prev) => {
        const last = prev[prev.length - 1]
        if (last && last.role === 'assistant' && last.content === '') {
          return prev.slice(0, -1)
        }
        return prev
      })
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="chat">
      <div className="chat__messages">
        {messages.length === 0 && (
          <p className="chat__empty">
            问我任何装修问题，比如「150 平米大概要花多少钱？」「是先做水电还是先贴砖？」
          </p>
        )}
        {messages.map((message, index) => {
          const isStreaming =
            loading && index === messages.length - 1 && message.role === 'assistant'
          return (
            <div key={index} className={`chat__message chat__message--${message.role}`}>
              {message.content || (isStreaming ? '思考中…' : '')}
              {message.sources && message.sources.length > 0 && (
                <div className="chat__sources">
                  依据：{message.sources.map((source) => source.source).join('、')}
                </div>
              )}
            </div>
          )
        })}
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
        <button onClick={() => void handleSend()} disabled={loading || input.trim().length === 0}>
          发送
        </button>
      </div>
    </div>
  )
}
