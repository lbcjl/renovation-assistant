import { ChatWindow } from './components/ChatWindow'

function App() {
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
      </header>
      <main className="app__main">
        <ChatWindow />
      </main>
    </div>
  )
}

export default App
