import axios from 'axios'
import api from './api'

export type ProviderSection = 'llm' | 'image'

export interface ProviderSettings {
  base_url: string
  model: string
  api_key_set: boolean
  api_key_preview: string
}

export interface ModelListResponse {
  models: string[]
  default: string
}

interface ErrorResponse {
  detail?: string
}

function toError(err: unknown, fallback: string): Error {
  if (axios.isAxiosError<ErrorResponse>(err)) {
    const detail = err.response?.data.detail
    return new Error(typeof detail === 'string' ? detail : fallback)
  }
  return err instanceof Error ? err : new Error(fallback)
}

/** Current connection settings for a provider (API key is masked). */
export async function fetchProviderSettings(provider: ProviderSection): Promise<ProviderSettings> {
  try {
    const response = await api.get<ProviderSettings>(`/settings/${provider}`)
    return response.data
  } catch (err) {
    throw toError(err, '获取配置失败')
  }
}

/** Save connection settings; empty apiKey keeps the currently saved key. */
export async function saveProviderSettings(
  provider: ProviderSection,
  settings: { base_url: string; model: string; api_key?: string },
): Promise<ProviderSettings> {
  try {
    const response = await api.put<ProviderSettings>(`/settings/${provider}`, settings)
    return response.data
  } catch (err) {
    throw toError(err, '保存配置失败')
  }
}

/** Probe an endpoint for its model list; empty fields use the saved config. */
export async function fetchProviderModels(
  provider: ProviderSection,
  params: { base_url?: string; api_key?: string },
): Promise<ModelListResponse> {
  try {
    const response = await api.post<ModelListResponse>(`/settings/${provider}/models`, params)
    return response.data
  } catch (err) {
    throw toError(err, '获取模型列表失败，请检查地址和 Key')
  }
}
