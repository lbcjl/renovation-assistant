import { useEffect, useState } from 'react'
import {
  fetchProviderModels,
  fetchProviderSettings,
  saveProviderSettings,
  type ProviderSection,
} from '../api/settings'

interface ProviderSettingsFormProps {
  provider: ProviderSection
  title: string
  description: string
}

export function ProviderSettingsForm({ provider, title, description }: ProviderSettingsFormProps) {
  const [baseUrl, setBaseUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [keyPreview, setKeyPreview] = useState('')
  const [models, setModels] = useState<string[]>([])
  const [model, setModel] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    void loadSettings()
  }, [provider])

  async function loadSettings(): Promise<void> {
    try {
      const settings = await fetchProviderSettings(provider)
      setBaseUrl(settings.base_url)
      setModel(settings.model)
      setKeyPreview(settings.api_key_set ? settings.api_key_preview : '')
      // Until the user fetches a fresh list, offer the saved model as the only option.
      setModels(settings.model ? [settings.model] : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取配置失败')
    }
  }

  async function handleFetchModels(): Promise<void> {
    if (!baseUrl.trim()) {
      setError('请先填写中转站地址')
      return
    }
    setFetching(true)
    setError('')
    setSuccess('')
    try {
      const list = await fetchProviderModels(provider, {
        base_url: baseUrl.trim(),
        api_key: apiKey.trim() || undefined,
      })
      setModels(list.models)
      if (list.models.length === 0) {
        setError('该端点没有返回任何模型')
      } else if (!list.models.includes(model)) {
        setModel(list.models.includes(list.default) ? list.default : list.models[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取模型列表失败')
    } finally {
      setFetching(false)
    }
  }

  async function handleSave(): Promise<void> {
    if (!baseUrl.trim() || !model) {
      setError('请填写中转站地址并选择模型')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = await saveProviderSettings(provider, {
        base_url: baseUrl.trim(),
        model,
        api_key: apiKey.trim() || undefined,
      })
      setKeyPreview(saved.api_key_preview)
      setApiKey('')
      setSuccess('已保存，立即生效')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存配置失败')
    } finally {
      setSaving(false)
    }
  }

  const busy = fetching || saving

  return (
    <section className="settings__card">
      <h2 className="settings__title">{title}</h2>
      <p className="settings__desc">{description}</p>

      <div className="settings__field">
        <label className="settings__label" htmlFor={`${provider}-base-url`}>
          中转站地址（Base URL）
        </label>
        <input
          id={`${provider}-base-url`}
          className="settings__input"
          type="text"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="例如：https://muyuan.do/v1"
          disabled={busy}
        />
      </div>

      <div className="settings__field">
        <label className="settings__label" htmlFor={`${provider}-api-key`}>
          API Key
        </label>
        <input
          id={`${provider}-api-key`}
          className="settings__input"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={keyPreview ? `已配置（${keyPreview}），留空保持不变` : '请输入 API Key'}
          disabled={busy}
        />
      </div>

      <div className="settings__field">
        <label className="settings__label" htmlFor={`${provider}-model`}>
          模型
        </label>
        <div className="settings__model-row">
          <select
            id={`${provider}-model`}
            className="settings__select"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={busy || models.length === 0}
          >
            {models.length === 0 && <option value="">先获取模型列表</option>}
            {models.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="settings__button settings__button--secondary"
            onClick={() => void handleFetchModels()}
            disabled={busy}
          >
            {fetching ? '获取中…' : '获取模型列表'}
          </button>
        </div>
      </div>

      {error && <p className="settings__error">{error}</p>}
      {success && <p className="settings__success">{success}</p>}

      <button
        type="button"
        className="settings__button"
        onClick={() => void handleSave()}
        disabled={busy}
      >
        {saving ? '保存中…' : '保存配置'}
      </button>
    </section>
  )
}
