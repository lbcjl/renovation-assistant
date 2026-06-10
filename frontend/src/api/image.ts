import axios, { AxiosError } from 'axios'
import api from './api'

export interface ImageGenerationResponse {
  image_url: string
}

interface ErrorResponse {
  detail?: string
}

function messageFor(err: AxiosError<ErrorResponse>): string {
  const status = err.response?.status
  if (status === 503) return '图像生成服务暂时不可用，已自动重试仍失败，请稍后再试'
  if (status === 422) return '描述内容不符合要求：不能为空，且不超过 1000 字'
  if (status != null) return '生成失败，请重试'
  return '无法连接服务器，请确认后端服务已启动'
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await api.post<ImageGenerationResponse>('/image/generate', { prompt })
    return response.data.image_url
  } catch (err) {
    if (axios.isAxiosError<ErrorResponse>(err)) {
      throw new Error(messageFor(err))
    }
    throw err
  }
}
