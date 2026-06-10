import axios from 'axios'
import api from './api'

export interface ModelListResponse {
  models: string[]
  default: string
}

interface ErrorResponse {
  detail?: string
}

/** Fetch the chat models available on the configured LLM endpoint. */
export async function fetchModels(): Promise<ModelListResponse> {
  try {
    const response = await api.get<ModelListResponse>('/models')
    return response.data
  } catch (err) {
    if (axios.isAxiosError<ErrorResponse>(err)) {
      throw new Error(err.response?.data.detail ?? '获取模型列表失败')
    }
    throw err
  }
}
