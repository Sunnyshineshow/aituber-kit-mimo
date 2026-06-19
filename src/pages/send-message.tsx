import { useEffect, useMemo, useState } from 'react'
import settingsStore from '@/features/stores/settings'
import { useTranslation } from 'react-i18next'

type EndpointId =
  | 'speak'
  | 'chat'
  | 'stop'
  | 'status'
  | 'events'
  | 'legacy_direct'
  | 'legacy_ai'
  | 'legacy_user'

type EndpointDefinition = {
  id: EndpointId
  group: 'v1' | 'legacy'
  label: string
  method: 'GET' | 'POST'
  path: string
  description: string
  requiresApiKey: boolean
  defaultBody?: Record<string, unknown>
}

const endpoints: EndpointDefinition[] = [
  {
    id: 'speak',
    group: 'v1',
    label: 'Speak',
    method: 'POST',
    path: '/api/v1/speak/',
    description: 'テキストをそのままキャラクターに発話させます。',
    requiresApiKey: true,
    defaultBody: {
      text: 'こんにちは。外部APIからの発話テストです。',
      emotion: 'neutral',
      priority: 'normal',
      interrupt: false,
    },
  },
  {
    id: 'chat',
    group: 'v1',
    label: 'Chat',
    method: 'POST',
    path: '/api/v1/chat/',
    description: 'AITuberKitの入力欄に送った場合と同じ会話処理に流します。',
    requiresApiKey: true,
    defaultBody: {
      text: '今日の配信で一言あいさつしてください。',
      mode: 'user_input',
      interrupt: false,
    },
  },
  {
    id: 'stop',
    group: 'v1',
    label: 'Stop',
    method: 'POST',
    path: '/api/v1/stop/',
    description: '現在の発話と待機中の制御を停止します。',
    requiresApiKey: true,
    defaultBody: {
      mode: 'all',
      reason: 'manual_api_console',
    },
  },
  {
    id: 'status',
    group: 'v1',
    label: 'Status',
    method: 'GET',
    path: '/api/v1/status/',
    description: '接続中クライアントの状態とキュー件数を取得します。',
    requiresApiKey: true,
  },
  {
    id: 'events',
    group: 'v1',
    label: 'Events Snapshot',
    method: 'GET',
    path: '/api/v1/events/',
    description: '直近のAPIイベントを取得します。SSE接続の確認にも使えます。',
    requiresApiKey: true,
  },
  {
    id: 'legacy_direct',
    group: 'legacy',
    label: 'Legacy Direct Send',
    method: 'POST',
    path: '/api/messages/',
    description: '旧API: そのまま発話させる direct_send です。',
    requiresApiKey: false,
    defaultBody: {
      messages: ['こんにちは、今日もいい天気ですね。'],
    },
  },
  {
    id: 'legacy_ai',
    group: 'legacy',
    label: 'Legacy AI Generate',
    method: 'POST',
    path: '/api/messages/',
    description: '旧API: AIで回答を生成してから発話させます。',
    requiresApiKey: false,
    defaultBody: {
      systemPrompt: 'You are a helpful assistant.',
      useCurrentSystemPrompt: false,
      messages: ['この画像について説明してください。'],
      image: 'data:image/png;base64,...',
    },
  },
  {
    id: 'legacy_user',
    group: 'legacy',
    label: 'Legacy User Input',
    method: 'POST',
    path: '/api/messages/',
    description: '旧API: 通常のユーザー入力として処理します。',
    requiresApiKey: false,
    defaultBody: {
      messages: ['こんにちは。'],
    },
  },
]

const legacyTypeByEndpoint: Partial<Record<EndpointId, string>> = {
  legacy_direct: 'direct_send',
  legacy_ai: 'ai_generate',
  legacy_user: 'user_input',
}

const stringifyBody = (body?: Record<string, unknown>) =>
  body ? JSON.stringify(body, null, 2) : ''

const SendMessage = () => {
  const { t } = useTranslation()
  const [selectedId, setSelectedId] = useState<EndpointId>('speak')
  const [clientId, setClientId] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [requestBody, setRequestBody] = useState(
    stringifyBody(endpoints[0].defaultBody)
  )
  const [responseText, setResponseText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [copyStatus, setCopyStatus] = useState('')

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === selectedId)!,
    [selectedId]
  )

  useEffect(() => {
    const storedClientId = settingsStore.getState().clientId
    if (storedClientId) {
      setClientId(storedClientId)
    }
  }, [])

  useEffect(() => {
    setBaseUrl(window.location.origin)
    setApiKey(window.sessionStorage.getItem('aituberkit-api-key') || '')
  }, [])

  useEffect(() => {
    if (apiKey) {
      window.sessionStorage.setItem('aituberkit-api-key', apiKey)
    } else {
      window.sessionStorage.removeItem('aituberkit-api-key')
    }
  }, [apiKey])

  const buildUrl = () => {
    const url = new URL(
      selectedEndpoint.path,
      baseUrl || 'http://localhost:3000'
    )

    if (clientId) {
      url.searchParams.set('clientId', clientId)
    }

    const legacyType = legacyTypeByEndpoint[selectedEndpoint.id]
    if (legacyType) {
      url.searchParams.set('type', legacyType)
    }

    if (selectedEndpoint.id === 'events') {
      url.searchParams.set('snapshot', 'true')
    }

    return url
  }

  const parseBody = () => {
    if (selectedEndpoint.method === 'GET' || !requestBody.trim()) {
      return undefined
    }

    return JSON.parse(requestBody)
  }

  const buildCurlSample = () => {
    const url = buildUrl().toString()
    const headers = ['-H "Content-Type: application/json"']

    if (selectedEndpoint.requiresApiKey) {
      headers.push('-H "Authorization: Bearer YOUR_API_KEY"')
    }

    const body =
      selectedEndpoint.method === 'POST' && requestBody.trim()
        ? ` \\\n  -d '${requestBody.replace(/\n/g, '')}'`
        : ''

    return `curl -X ${selectedEndpoint.method} \\\n  ${headers.join(
      ' \\\n  '
    )}${body} \\\n  '${url}'`
  }

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopyStatus(t('ApiConsole.copied'))
    setTimeout(() => setCopyStatus(''), 1600)
  }

  const handleEndpointChange = (endpoint: EndpointDefinition) => {
    setSelectedId(endpoint.id)
    setRequestBody(stringifyBody(endpoint.defaultBody))
    setResponseText('')
  }

  const handleSubmit = async () => {
    if (!clientId.trim()) {
      setResponseText(t('ApiConsole.clientIdRequired'))
      return
    }

    if (selectedEndpoint.requiresApiKey && !apiKey.trim()) {
      setResponseText(t('ApiConsole.apiKeyRequired'))
      return
    }

    setIsSending(true)
    setResponseText('')

    try {
      const body = parseBody()
      const res = await fetch(buildUrl(), {
        method: selectedEndpoint.method,
        headers: {
          ...(selectedEndpoint.method === 'POST'
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(selectedEndpoint.requiresApiKey
            ? { Authorization: `Bearer ${apiKey.trim()}` }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      })

      const contentType = res.headers.get('content-type') || ''
      const payload = contentType.includes('application/json')
        ? await res.json()
        : await res.text()

      setResponseText(
        JSON.stringify(
          {
            status: res.status,
            ok: res.ok,
            body: payload,
          },
          null,
          2
        )
      )
    } catch (error) {
      setResponseText(
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : String(error),
          },
          null,
          2
        )
      )
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-theme text-theme-default">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="flex flex-col gap-2 border-b border-gray-200 pb-4">
          <h1 className="text-2xl font-bold">{t('ApiConsole.title')}</h1>
          <p className="text-sm text-gray-600">{t('ApiConsole.description')}</p>
        </header>

        <section className="grid gap-4 md:grid-cols-[260px_1fr]">
          <nav className="flex flex-col gap-4">
            {(['v1', 'legacy'] as const).map((group) => (
              <div key={group} className="border border-gray-200 bg-white p-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">
                  {group === 'v1'
                    ? t('ApiConsole.v1Endpoints')
                    : t('ApiConsole.legacyEndpoints')}
                </div>
                <div className="flex flex-col gap-1">
                  {endpoints
                    .filter((endpoint) => endpoint.group === group)
                    .map((endpoint) => (
                      <button
                        key={endpoint.id}
                        type="button"
                        onClick={() => handleEndpointChange(endpoint)}
                        className={`w-full px-3 py-2 text-left text-sm font-medium ${
                          selectedId === endpoint.id
                            ? 'bg-primary text-theme'
                            : 'bg-transparent hover:bg-gray-100'
                        }`}
                      >
                        <span className="mr-2 inline-block w-12 text-xs opacity-80">
                          {endpoint.method}
                        </span>
                        {endpoint.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </nav>

          <div className="flex flex-col gap-4">
            <section className="grid gap-3 border border-gray-200 bg-white p-4 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t('ClientID')}
                <input
                  type="text"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  className="border border-gray-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-bold">
                {t('ApiConsole.apiKey')}
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="border border-gray-300 px-3 py-2 font-normal"
                  placeholder={t('ApiConsole.apiKeyPlaceholder')}
                />
              </label>
            </section>

            <section className="border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-gray-900 px-2 py-1 text-xs font-bold text-white">
                      {selectedEndpoint.method}
                    </span>
                    <h2 className="text-xl font-bold">
                      {selectedEndpoint.label}
                    </h2>
                  </div>
                  <p className="mt-2 text-sm text-gray-600">
                    {selectedEndpoint.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(buildCurlSample())}
                  className="border border-gray-300 px-3 py-2 text-sm font-bold hover:bg-gray-100"
                >
                  {t('ApiConsole.copyCurl')}
                </button>
              </div>

              <div className="mb-4 bg-gray-950 p-3 font-mono text-xs text-gray-100">
                {buildUrl().toString()}
              </div>

              {selectedEndpoint.method === 'POST' && (
                <label className="mb-4 flex flex-col gap-2 text-sm font-bold">
                  {t('ApiConsole.requestBody')}
                  <textarea
                    value={requestBody}
                    onChange={(event) => setRequestBody(event.target.value)}
                    className="min-h-[220px] border border-gray-300 bg-gray-50 p-3 font-mono text-sm font-normal"
                    spellCheck={false}
                  />
                </label>
              )}

              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-bold">cURL</span>
                  {copyStatus && (
                    <span className="text-xs text-gray-500">{copyStatus}</span>
                  )}
                </div>
                <pre className="max-h-44 overflow-auto bg-gray-950 p-3 text-xs text-gray-100">
                  <code>{buildCurlSample()}</code>
                </pre>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSending}
                className="bg-primary px-4 py-2 text-sm font-bold text-theme hover:bg-primary-hover disabled:opacity-50"
              >
                {isSending ? t('ApiConsole.sending') : t('ApiConsole.send')}
              </button>
            </section>

            <section className="border border-gray-200 bg-white p-4">
              <h2 className="mb-3 text-lg font-bold">
                {t('ApiConsole.response')}
              </h2>
              <pre className="min-h-[180px] overflow-auto bg-gray-950 p-3 text-sm text-gray-100">
                <code>{responseText || t('ApiConsole.noResponse')}</code>
              </pre>
            </section>
          </div>
        </section>
      </main>
    </div>
  )
}

export default SendMessage
