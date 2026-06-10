import { useState } from 'react'
import { generateImage } from '../api/image'
import './ImageGenerator.css'

export function ImageGenerator() {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请输入描述')
      return
    }

    setLoading(true)
    setError('')
    try {
      const url = await generateImage(prompt)
      setImageUrl(url)
    } catch (err) {
      setError('生成失败，请重试')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="image-generator">
      <h2 className="image-generator__title">AI 生成效果图</h2>
      <div className="image-generator__form">
        <textarea
          className="image-generator__textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="描述你想要的装修效果，例如：现代简约风格客厅，白色墙面，木质地板，落地窗"
          rows={3}
        />
        <button
          className="image-generator__button"
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
        >
          {loading ? '生成中...' : '生成效果图'}
        </button>
      </div>
      {error && <div className="image-generator__error">{error}</div>}
      {imageUrl && (
        <div className="image-generator__result">
          <img src={imageUrl} alt="生成的效果图" className="image-generator__image" />
        </div>
      )}
    </div>
  )
}
