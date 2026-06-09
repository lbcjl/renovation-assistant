import { useState, type FormEvent, type KeyboardEvent } from 'react'

interface LoginFormProps {
  onLoginSuccess: (username: string, token: string) => void
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { login } = await import('../api/auth')
      const response = await login(username.trim(), password)
      onLoginSuccess(response.username, response.access_token)
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      const form = event.currentTarget.form
      if (form) {
        form.requestSubmit()
      }
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__header">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="login__icon"
          >
            <path d="M3 10.5 12 3l9 7.5" />
            <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
            <path d="M9.5 21v-6h5v6" />
          </svg>
          <h1 className="login__title">装修小助手</h1>
          <p className="login__subtitle">请登录以继续</p>
        </div>

        <form className="login__form" onSubmit={handleSubmit}>
          <div className="login__field">
            <label htmlFor="username" className="login__label">
              用户名
            </label>
            <input
              type="text"
              id="username"
              className="login__input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="login__field">
            <label htmlFor="password" className="login__label">
              密码
            </label>
            <input
              type="password"
              id="password"
              className="login__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login__error">{error}</p>}

          <button type="submit" className="login__button" disabled={loading}>
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
