import type { LoginResponse, User } from '../types'
import { hashPassword } from '../utils/crypto'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export async function login(username: string, password: string): Promise<LoginResponse> {
  // Hash password before sending to prevent plaintext transmission
  const hashedPassword = hashPassword(password)

  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: hashedPassword }),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('用户名或密码错误')
    }
    throw new Error(`登录失败 (${response.status})`)
  }

  return response.json()
}

export async function getCurrentUser(token: string): Promise<User> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  })

  if (!response.ok) {
    throw new Error('Token 无效或已过期')
  }

  return response.json()
}

export function logout(): void {
  // Client-side only: just clear the token
  // Server doesn't maintain sessions
}
