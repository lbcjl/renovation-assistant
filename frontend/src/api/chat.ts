import type { ChatMessage, Source } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface StreamHandlers {
  onSources: (sources: Source[]) => void
  onDelta: (delta: string) => void
}

interface SsePayload {
  sources?: Source[]
  delta?: string
  detail?: string
}

function handleBlock(block: string, handlers: StreamHandlers): void {
  let event: string | null = null
  let data: string | null = null
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim()
    } else if (line.startsWith('data:')) {
      data = line.slice('data:'.length).trim()
    }
  }
  if (data === null) {
    return
  }

  const payload = JSON.parse(data) as SsePayload
  if (event === 'error') {
    throw new Error(payload.detail ?? 'LLM 服务出错')
  }
  if (event === 'sources' && payload.sources) {
    handlers.onSources(payload.sources)
  } else if (payload.delta) {
    handlers.onDelta(payload.delta)
  }
}

/**
 * Stream an answer from the backend over SSE. `onSources` fires once with the
 * cited knowledge-base sources; `onDelta` fires for each text chunk. The system
 * prompt is added server-side, so only user/assistant turns are sent.
 */
export async function streamChat(messages: ChatMessage[], handlers: StreamHandlers): Promise<void> {
  const payload = messages.map(({ role, content }) => ({ role, content }))
  const response = await fetch(`${API_BASE_URL}/chat/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: payload }),
  })

  if (!response.ok || !response.body) {
    throw new Error(`请求失败 (${response.status})`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    buffer += decoder.decode(value, { stream: true })
    let sepIndex = buffer.indexOf('\n\n')
    while (sepIndex !== -1) {
      handleBlock(buffer.slice(0, sepIndex), handlers)
      buffer = buffer.slice(sepIndex + 2)
      sepIndex = buffer.indexOf('\n\n')
    }
  }
}
