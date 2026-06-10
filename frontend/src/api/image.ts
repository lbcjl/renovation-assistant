import axios from 'axios'
import api from './api'

export interface ImageGenerationResponse {
  image_url: string
}

interface ErrorResponse {
  detail?: string
}

export async function generateImage(prompt: string): Promise<string> {
  try {
    const response = await api.post<ImageGenerationResponse>('/image/generate', { prompt })
    return response.data.image_url
  } catch (err) {
    if (axios.isAxiosError<ErrorResponse>(err)) {
      throw new Error(err.response?.data.detail ?? err.message)
    }
    throw err
  }
}
