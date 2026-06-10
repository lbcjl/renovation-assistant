import { useEffect, useState } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { ImageGenerator } from './components/ImageGenerator'
import { LoginForm } from './components/LoginForm'
import { getCurrentUser } from './api/auth'
import { clearToken, getToken, setToken } from './utils/token'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [authChecking, setAuthChecking] = useState(true)

  // Check for existing token on mount
  useEffect(() => {
    async function checkAuth() {
      const token = getToken()
      if (!token) {
        setAuthChecking(false)
        return
      }

      try {
        const user = await getCurrentUser(token)
        setCurrentUser(user.username)
        setIsAuthenticated(true)
      } catch {
        clearToken()
      } finally {
        setAuthChecking(false)
      }
    }

    void checkAuth()
  }, [])

  function handleLoginSuccess(username: string, token: string): void {
    setToken(token)
    setCurrentUser(username)
    setIsAuthenticated(true)
  }

  function handleLogout(): void {
    clearToken()
    setCurrentUser(null)
    setIsAuthenticated(false)
  }

  if (authChecking) {
    return (
      <div className="app">
        <div className="app__loading">加载中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="app">
        <LoginForm onLoginSuccess={handleLoginSuccess} />
      </div>
    )
  }

  return (
    <div className="app">
      <header className="app__header">
        <div className="app__brand">
          <span className="app__logo" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
              <path d="M9.5 21v-6h5v6" />
            </svg>
          </span>
          <div>
            <h1 className="app__title">装修小助手</h1>
            <p className="app__subtitle">面向业主的装修问答顾问 · 基于知识库解答，标注依据</p>
          </div>
        </div>
        <div className="app__user">
          <span className="app__username">{currentUser}</span>
          <button type="button" className="app__logout" onClick={handleLogout}>
            登出
          </button>
        </div>
      </header>
      <main className="app__main">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', height: '100%' }}>
          <ChatWindow onAuthError={handleLogout} />
          <ImageGenerator />
        </div>
      </main>
    </div>
  )
}

export default App
