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
