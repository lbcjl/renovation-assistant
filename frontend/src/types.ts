export type ChatRole = 'user' | 'assistant'

export interface Source {
  source: string
  score: number
}

export interface ChatMessage {
  role: ChatRole
  content: string
  /** Knowledge-base sources cited for an assistant answer (RAG). */
  sources?: Source[]
}

// --- Authentication types ---

export interface User {
  username: string
  is_active: boolean
}

export interface LoginResponse {
  access_token: string
  token_type: string
  username: string
}
