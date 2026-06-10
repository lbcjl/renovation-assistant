import { useState } from 'react'
import { ChatWindow } from './components/ChatWindow'
import { ImageGenerator } from './components/ImageGenerator'

type Page = 'chat' | 'image'

function App() {
  const [page, setPage] = useState<Page>('chat')

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
          <span className="app__username">测试模式</span>
        </div>
      </header>
      <nav className="app__nav" aria-label="功能页面切换">
        <button
          className={`app__tab${page === 'chat' ? ' app__tab--active' : ''}`}
          onClick={() => setPage('chat')}
        >
          装修问答
        </button>
        <button
          className={`app__tab${page === 'image' ? ' app__tab--active' : ''}`}
          onClick={() => setPage('image')}
        >
          AI 效果图
        </button>
      </nav>
      <main className="app__main">
        {/* Both pages stay mounted so chat history and generated images survive tab switches. */}
        <div className={`app__page${page === 'chat' ? '' : ' app__page--hidden'}`}>
          <ChatWindow />
        </div>
        <div className={`app__page${page === 'image' ? '' : ' app__page--hidden'}`}>
          <ImageGenerator />
        </div>
      </main>
    </div>
  )
}

export default App
