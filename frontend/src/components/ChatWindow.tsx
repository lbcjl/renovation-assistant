import { useState, type KeyboardEvent } from 'react'
import { postChat } from '../api/chat'
import type { ChatMessage } from '../types'

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

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setError(null)
    setLoading(true)

    try {
      const { reply, sources } = await postChat(nextMessages)
      setMessages([...nextMessages, { role: 'assistant', content: reply, sources }])
    } catch (err) {
      setError(err instanceof Error ? err.message : '出错了，请稍后重试')
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
        {messages.map((message, index) => (
          <div key={index} className={`chat__message chat__message--${message.role}`}>
            {message.content}
            {message.sources && message.sources.length > 0 && (
              <div className="chat__sources">
                依据：{message.sources.map((source) => source.source).join('、')}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="chat__message chat__message--assistant">思考中…</div>}
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
