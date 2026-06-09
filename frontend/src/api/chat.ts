import type { ChatMessage, Source } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface ChatReply {
  reply: string
  sources: Source[]
}

/**
 * Send the conversation to the backend and return the assistant reply plus the
 * knowledge-base sources it was grounded in. The system prompt is added
 * server-side, so only user/assistant turns are sent here.
 */
export async function postChat(messages: ChatMessage[]): Promise<ChatReply> {
  const payload = messages.map(({ role, content }) => ({ role, content }))
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: payload }),
  })

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`)
  }

  return (await response.json()) as ChatReply
}
