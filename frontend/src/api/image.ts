import api from './api'
import { getToken } from '../utils/token'

export interface ImageGenerationResponse {
  image_url: string
}

export async function generateImage(prompt: string): Promise<string> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录，请先登录')
  }

  const response = await api.post<ImageGenerationResponse>(
    '/image/generate',
    { prompt },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  )
  return response.data.image_url
}
