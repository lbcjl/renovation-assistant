import { ChatWindow } from './components/ChatWindow'

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1>装修小助手</h1>
        <p>面向业主的装修问答顾问 · MVP</p>
      </header>
      <main className="app__main">
        <ChatWindow />
      </main>
    </div>
  )
}

export default App
