import type { ChatMessage } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

interface ChatResponse {
  reply: string
}

/**
 * Send the conversation to the backend and return the assistant reply.
 * The system prompt is added server-side, so only user/assistant turns
 * are sent here.
 */
export async function postChat(messages: ChatMessage[]): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })

  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`)
  }

  const data = (await response.json()) as ChatResponse
  return data.reply
}
