import { useEffect, useMemo, useState } from 'react'
import settingsStore from '@/features/stores/settings'
import { useTranslation } from 'react-i18next'
import {
  BoltIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClipboardDocumentIcon,
  CodeBracketSquareIcon,
  CommandLineIcon,
  KeyIcon,
  PaperAirplaneIcon,
  PlayIcon,
  ServerStackIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

type EndpointId =
  | 'speak'
  | 'chat'
  | 'stop'
  | 'status'
  | 'events'
  | 'legacy_direct'
  | 'legacy_ai'
  | 'legacy_user'

type CodeSampleId = 'curl' | 'node' | 'python'

type EndpointDefinition = {
  id: EndpointId
  group: 'v1' | 'legacy'
  label: string
  method: 'GET' | 'POST'
  path: string
  description: string
  requiresApiKey: boolean
  defaultBody?: Record<string, unknown>
  fields: Array<{
    name: string
    type: string
    required?: boolean
    description: string
  }>
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
    fields: [
      {
        name: 'text',
        type: 'string',
        required: true,
        description: '発話させる本文です。messages の代わりに指定できます。',
      },
      {
        name: 'messages',
        type: 'string[]',
        description: '複数文をまとめてキューに入れる場合に使います。',
      },
      {
        name: 'emotion',
        type: 'string',
        description: '発話時の表情・感情指定です。未指定なら通常状態です。',
      },
      {
        name: 'priority',
        type: '"normal" | "high"',
        description: 'high の場合は通常より前にキューへ入れます。',
      },
      {
        name: 'interrupt',
        type: 'boolean',
        description:
          'true の場合、現在の発話/待機キューを止めてからこの発話を入れます。',
      },
    ],
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
    fields: [
      {
        name: 'text',
        type: 'string',
        required: true,
        description:
          'キャラクターへ渡す入力文です。messages の代わりに指定できます。',
      },
      {
        name: 'messages',
        type: 'string[]',
        description: '複数の入力文をまとめて送る場合に使います。',
      },
      {
        name: 'mode',
        type: '"user_input" | "ai_generate"',
        description:
          'user_input は通常入力欄と同じ送信フロー、ai_generate は外部API互換のAI生成フローです。',
      },
      {
        name: 'systemPrompt',
        type: 'string',
        description:
          'mode が ai_generate で useCurrentSystemPrompt=false のときに使うシステムプロンプトです。',
      },
      {
        name: 'useCurrentSystemPrompt',
        type: 'boolean',
        description:
          'mode が ai_generate のとき、現在のキャラクター設定のシステムプロンプトを使うかどうかです。既定値は true です。',
      },
      {
        name: 'image',
        type: 'string',
        description:
          'data URL などの画像文字列です。画像付き入力として処理します。',
      },
      {
        name: 'priority',
        type: '"normal" | "high"',
        description: 'high の場合は通常より前にキューへ入れます。',
      },
      {
        name: 'interrupt',
        type: 'boolean',
        description:
          'true の場合、現在の発話/待機キューを止めてからこの入力を入れます。',
      },
    ],
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
    fields: [
      {
        name: 'mode',
        type: '"speech" | "queue" | "all"',
        description:
          '停止範囲です。speech は現在の発話、queue は待機キュー、all は両方を止めます。未指定時は all です。',
      },
      {
        name: 'reason',
        type: 'string',
        description: '停止理由のメモです。イベントログ確認用に残せます。',
      },
    ],
  },
  {
    id: 'status',
    group: 'v1',
    label: 'Status',
    method: 'GET',
    path: '/api/v1/status/',
    description: '接続中クライアントの状態とキュー件数を取得します。',
    requiresApiKey: true,
    fields: [
      {
        name: 'clientId',
        type: 'query string',
        required: true,
        description: '状態を取得する Message Receiver の Client ID です。',
      },
    ],
  },
  {
    id: 'events',
    group: 'v1',
    label: 'Events Snapshot',
    method: 'GET',
    path: '/api/v1/events/',
    description: '直近のAPIイベントを取得します。SSE接続の確認にも使えます。',
    requiresApiKey: true,
    fields: [
      {
        name: 'clientId',
        type: 'query string',
        description: '指定した Client ID のイベントだけに絞り込めます。',
      },
      {
        name: 'snapshot',
        type: 'query boolean',
        description:
          'true の場合は直近イベントをJSONで返します。未指定の場合はSSE接続になります。',
      },
    ],
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
    fields: [
      {
        name: 'messages',
        type: 'string[]',
        required: true,
        description: 'そのまま発話させる本文の配列です。',
      },
    ],
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
    fields: [
      {
        name: 'messages',
        type: 'string[]',
        required: true,
        description: 'AIへ渡すユーザー入力の配列です。',
      },
      {
        name: 'systemPrompt',
        type: 'string',
        description:
          'useCurrentSystemPrompt=false のときに使うシステムプロンプトです。',
      },
      {
        name: 'useCurrentSystemPrompt',
        type: 'boolean',
        description:
          '現在のキャラクター設定のシステムプロンプトを使うかどうかです。',
      },
      {
        name: 'image',
        type: 'string',
        description: 'data URL などの画像文字列です。',
      },
    ],
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
    fields: [
      {
        name: 'messages',
        type: 'string[]',
        required: true,
        description: '通常のユーザー入力として処理する本文の配列です。',
      },
    ],
  },
]

const legacyTypeByEndpoint: Partial<Record<EndpointId, string>> = {
  legacy_direct: 'direct_send',
  legacy_ai: 'ai_generate',
  legacy_user: 'user_input',
}

const codeSampleTabs: Array<{ id: CodeSampleId; label: string }> = [
  { id: 'curl', label: 'cURL' },
  { id: 'node', label: 'Node.js' },
  { id: 'python', label: 'Python' },
]

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
  const [selectedSample, setSelectedSample] = useState<CodeSampleId>('curl')
  const [endpointsOpen, setEndpointsOpen] = useState(false)

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
  }, [])

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
    const headers =
      selectedEndpoint.method === 'POST'
        ? ['-H "Content-Type: application/json"']
        : []

    if (selectedEndpoint.requiresApiKey) {
      headers.push('-H "Authorization: Bearer YOUR_API_KEY"')
    }

    const body =
      selectedEndpoint.method === 'POST' && requestBody.trim()
        ? ` \\\n  -d '${requestBody.replace(/\n/g, '')}'`
        : ''

    return `curl -X ${selectedEndpoint.method}${
      headers.length ? ` \\\n  ${headers.join(' \\\n  ')}` : ''
    }${body} \\\n  '${url}'`
  }

  const buildNodeSample = () => {
    const url = buildUrl().toString()
    const headers = [
      ...(selectedEndpoint.method === 'POST'
        ? [`'Content-Type': 'application/json'`]
        : []),
      ...(selectedEndpoint.requiresApiKey
        ? [`Authorization: 'Bearer YOUR_API_KEY'`]
        : []),
    ]
    const body = requestBody.trim() || '{}'
    const requestOptions = [
      `method: '${selectedEndpoint.method}'`,
      `headers: {${headers.length ? `\n    ${headers.join(',\n    ')}\n  ` : ''}}`,
      ...(selectedEndpoint.method === 'POST'
        ? [`body: JSON.stringify(${body})`]
        : []),
    ]

    return `const url = '${url}'

const response = await fetch(url, {
  ${requestOptions.join(',\n  ')}
})

console.log(response.status)
console.log(await response.json())`
  }

  const buildPythonSample = () => {
    const url = buildUrl().toString()
    const headers = [
      ...(selectedEndpoint.method === 'POST'
        ? [`'Content-Type': 'application/json'`]
        : []),
      ...(selectedEndpoint.requiresApiKey
        ? [`'Authorization': 'Bearer YOUR_API_KEY'`]
        : []),
    ]
    const body = requestBody.trim() || '{}'
    const requestArgs = [
      `'${selectedEndpoint.method}'`,
      'url',
      ...(headers.length ? ['headers=headers'] : []),
      ...(selectedEndpoint.method === 'POST' ? ['json=payload'] : []),
    ]

    return `${selectedEndpoint.method === 'POST' ? 'import json\n' : ''}import requests

url = '${url}'
${headers.length ? `headers = {\n    ${headers.join(',\n    ')}\n}\n` : ''}${
      selectedEndpoint.method === 'POST'
        ? `payload = json.loads(${JSON.stringify(body)})\n`
        : ''
    }
response = requests.request(${requestArgs.join(', ')})

print(response.status_code)
print(response.json())`
  }

  const getSelectedCodeSample = () => {
    if (selectedSample === 'node') return buildNodeSample()
    if (selectedSample === 'python') return buildPythonSample()
    return buildCurlSample()
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
    if (window.innerWidth < 1024) {
      setEndpointsOpen(false)
    }
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
    <div className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header className="border-b border-slate-200 bg-slate-950 text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
          <div className="flex flex-col gap-4">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase text-cyan-100">
                <CommandLineIcon className="h-4 w-4" aria-hidden="true" />
                External API
              </div>
              <h1 className="text-3xl font-bold tracking-normal md:text-4xl">
                {t('ApiConsole.title')}
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-300 md:text-base">
                {t('ApiConsole.description')}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 md:px-8 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-5 lg:self-start">
          <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200">
              <button
                type="button"
                onClick={() => setEndpointsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left lg:cursor-default"
                aria-expanded={endpointsOpen}
              >
                <span className="flex min-w-0 items-center gap-2 text-sm font-bold">
                  <ServerStackIcon className="h-5 w-5 shrink-0 text-slate-500" />
                  <span>Endpoints</span>
                  <span className="min-w-0 truncate rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600 lg:hidden">
                    {selectedEndpoint.method} {selectedEndpoint.label}
                  </span>
                </span>
                <ChevronDownIcon
                  className={`h-5 w-5 shrink-0 text-slate-500 transition lg:hidden ${
                    endpointsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>
            </div>
            <div className={`${endpointsOpen ? 'block' : 'hidden'} lg:block`}>
              {(['v1', 'legacy'] as const).map((group) => (
                <div
                  key={group}
                  className="border-b border-slate-100 p-3 last:border-b-0"
                >
                  <div className="mb-2 text-xs font-bold uppercase text-slate-500">
                    {group === 'v1'
                      ? t('ApiConsole.v1Endpoints')
                      : t('ApiConsole.legacyEndpoints')}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {endpoints
                      .filter((endpoint) => endpoint.group === group)
                      .map((endpoint) => (
                        <button
                          key={endpoint.id}
                          type="button"
                          onClick={() => handleEndpointChange(endpoint)}
                          className={`group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                            selectedId === endpoint.id
                              ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                              : 'border-transparent bg-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`inline-flex w-12 justify-center rounded-md px-2 py-1 text-[11px] font-bold ${
                              endpoint.method === 'GET'
                                ? selectedId === endpoint.id
                                  ? 'bg-emerald-400/20 text-emerald-100'
                                  : 'bg-emerald-50 text-emerald-700'
                                : selectedId === endpoint.id
                                  ? 'bg-cyan-400/20 text-cyan-100'
                                  : 'bg-cyan-50 text-cyan-700'
                            }`}
                          >
                            {endpoint.method}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-bold">
                            {endpoint.label}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </nav>
        </aside>

        <div className="grid min-w-0 gap-5">
          <section className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2">
            <label
              className={`flex flex-col gap-2 text-sm font-bold ${
                selectedEndpoint.requiresApiKey ? '' : 'md:col-span-2'
              }`}
            >
              <span className="flex items-center gap-2">
                <ShieldCheckIcon className="h-5 w-5 text-slate-500" />
                {t('ClientID')}
              </span>
              <input
                type="text"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
                className="h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              />
            </label>
            {selectedEndpoint.requiresApiKey && (
              <label className="flex flex-col gap-2 text-sm font-bold">
                <span className="flex items-center gap-2">
                  <KeyIcon className="h-5 w-5 text-slate-500" />
                  {t('ApiConsole.apiKey')}
                </span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 font-normal outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                  placeholder={t('ApiConsole.apiKeyPlaceholder')}
                />
              </label>
            )}
          </section>

          <section className="grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
            <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-4">
                <div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-bold text-white">
                        {selectedEndpoint.method}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {selectedEndpoint.requiresApiKey
                          ? 'API Key'
                          : 'No Auth'}
                      </span>
                      <h2 className="text-xl font-bold text-slate-950">
                        {selectedEndpoint.label}
                      </h2>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {selectedEndpoint.description}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid min-w-0 gap-4 p-4">
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <BoltIcon className="h-5 w-5 text-slate-500" />
                    Endpoint URL
                  </div>
                  <div className="min-w-0 overflow-auto rounded-lg bg-slate-950 px-3 py-3 font-mono text-xs text-slate-100">
                    {buildUrl().toString()}
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                    <CodeBracketSquareIcon className="h-5 w-5 text-slate-500" />
                    Parameters
                  </div>
                  <div className="overflow-hidden rounded-lg border border-slate-200">
                    {selectedEndpoint.fields.map((field) => (
                      <div
                        key={field.name}
                        className="grid gap-2 border-b border-slate-200 bg-white p-3 last:border-b-0 md:grid-cols-[180px_minmax(0,1fr)]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-bold text-slate-900">
                              {field.name}
                            </code>
                            {field.required && (
                              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-700">
                                required
                              </span>
                            )}
                          </div>
                          <div className="mt-1 font-mono text-xs text-slate-500">
                            {field.type}
                          </div>
                        </div>
                        <p className="min-w-0 text-sm leading-6 text-slate-700">
                          {field.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedEndpoint.method === 'POST' && (
                  <div className="grid min-w-0 gap-3">
                    {selectedEndpoint.id === 'chat' && (
                      <div className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm leading-6 text-slate-700">
                        <div className="mb-1 font-bold text-slate-900">
                          mode
                        </div>
                        <div>
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-cyan-800">
                            user_input
                          </code>
                          :
                          画面下の入力欄から送ったのと同じ扱いです。現在のキャラクター設定、チャット履歴、通常の送信フローを使います。
                        </div>
                        <div>
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-cyan-800">
                            ai_generate
                          </code>
                          : 外部API側でAI生成を明示する互換モードです。
                          <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-cyan-800">
                            systemPrompt
                          </code>
                          や
                          <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-cyan-800">
                            useCurrentSystemPrompt
                          </code>
                          を指定でき、旧APIの
                          <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs text-cyan-800">
                            type=ai_generate
                          </code>
                          に相当します。
                        </div>
                      </div>
                    )}
                    <label className="flex min-w-0 flex-col gap-2 text-sm font-bold text-slate-700">
                      <span className="flex items-center gap-2">
                        <CodeBracketSquareIcon className="h-5 w-5 text-slate-500" />
                        {t('ApiConsole.requestBody')}
                      </span>
                      <textarea
                        value={requestBody}
                        onChange={(event) => setRequestBody(event.target.value)}
                        className="min-h-[260px] w-full min-w-0 rounded-lg border border-slate-300 bg-slate-50 p-3 font-mono text-sm font-normal leading-6 text-slate-900 outline-none transition focus:border-slate-900 focus:bg-white focus:ring-2 focus:ring-slate-900/10"
                        spellCheck={false}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            <div className="grid min-w-0 content-start gap-5">
              <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <CommandLineIcon className="h-5 w-5 text-slate-500" />
                      実行コード
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
                    {codeSampleTabs.map((sample) => (
                      <button
                        key={sample.id}
                        type="button"
                        onClick={() => setSelectedSample(sample.id)}
                        className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                          selectedSample === sample.id
                            ? 'bg-white text-slate-950 shadow-sm'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid min-w-0 gap-4 p-4">
                  <div className="relative min-w-0">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(getSelectedCodeSample())}
                      aria-label="コードをコピー"
                      title="コードをコピー"
                      className="absolute right-2 top-2 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/10 bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
                    >
                      <ClipboardDocumentIcon className="h-5 w-5" />
                    </button>
                    {copyStatus && (
                      <span className="absolute right-12 top-2 z-10 inline-flex h-8 items-center gap-1 rounded-md bg-emerald-400/15 px-2 text-xs font-bold text-emerald-100">
                        <CheckCircleIcon className="h-4 w-4" />
                        {copyStatus}
                      </span>
                    )}
                    <pre className="max-h-64 min-w-0 overflow-auto rounded-lg bg-slate-950 p-3 pr-12 text-xs leading-5 text-slate-100">
                      <code>{getSelectedCodeSample()}</code>
                    </pre>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSending}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSending ? (
                      <BoltIcon className="h-5 w-5 animate-pulse" />
                    ) : (
                      <PlayIcon className="h-5 w-5" />
                    )}
                    {isSending ? t('ApiConsole.sending') : t('ApiConsole.send')}
                  </button>
                </div>
              </div>

              <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                    <PaperAirplaneIcon className="h-5 w-5 text-slate-500" />
                    {t('ApiConsole.response')}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                    JSON
                  </span>
                </div>
                <div className="p-4">
                  <pre className="min-h-[220px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
                    <code>{responseText || t('ApiConsole.noResponse')}</code>
                  </pre>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

export default SendMessage
