import type { FileMetadata } from '../types'
import { getToken } from '../utils/token'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export interface FileUploadResponse {
  file: FileMetadata
}

export interface FileListResponse {
  files: FileMetadata[]
}

export interface AddToKnowledgeBaseResponse {
  success: boolean
  message: string
}

/**
 * Upload a file to the server.
 * Requires authentication: reads JWT token from localStorage.
 *
 * @param file - The file to upload
 * @returns File metadata
 * @throws Error if upload fails or user is not authenticated
 */
export async function uploadFile(file: File): Promise<FileMetadata> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录，请先登录')
  }

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE_URL}/api/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('登录已过期，请重新登录')
    }
    if (response.status === 400) {
      const data = (await response.json()) as { detail: string }
      throw new Error(data.detail || '文件上传失败')
    }
    throw new Error(`上传失败 (${response.status})`)
  }

  const data = (await response.json()) as FileUploadResponse
  return data.file
}

/**
 * List all uploaded files for the current user.
 * Requires authentication: reads JWT token from localStorage.
 *
 * @returns Array of file metadata
 * @throws Error if request fails or user is not authenticated
 */
export async function listFiles(): Promise<FileMetadata[]> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录，请先登录')
  }

  const response = await fetch(`${API_BASE_URL}/api/files`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('登录已过期，请重新登录')
    }
    throw new Error(`获取文件列表失败 (${response.status})`)
  }

  const data = (await response.json()) as FileListResponse
  return data.files
}

/**
 * Delete a file.
 * Requires authentication: reads JWT token from localStorage.
 *
 * @param fileId - The file ID to delete
 * @throws Error if deletion fails or user is not authenticated
 */
export async function deleteFile(fileId: string): Promise<void> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录，请先登录')
  }

  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('登录已过期，请重新登录')
    }
    if (response.status === 404) {
      throw new Error('文件不存在')
    }
    throw new Error(`删除失败 (${response.status})`)
  }
}

/**
 * Add a file to the knowledge base.
 * Requires authentication: reads JWT token from localStorage.
 *
 * @param fileId - The file ID to add to knowledge base
 * @returns Response with success status and message
 * @throws Error if request fails or user is not authenticated
 */
export async function addToKnowledgeBase(fileId: string): Promise<AddToKnowledgeBaseResponse> {
  const token = getToken()
  if (!token) {
    throw new Error('未登录，请先登录')
  }

  const response = await fetch(`${API_BASE_URL}/api/files/${fileId}/add-to-kb`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('登录已过期，请重新登录')
    }
    if (response.status === 404) {
      throw new Error('文件不存在')
    }
    throw new Error(`操作失败 (${response.status})`)
  }

  return (await response.json()) as AddToKnowledgeBaseResponse
}
