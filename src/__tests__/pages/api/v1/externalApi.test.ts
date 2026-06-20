/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from 'next'

function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'POST',
    query: {},
    body: {},
    headers: {},
    ...overrides,
  } as NextApiRequest
}

function createMockRes(): NextApiResponse & {
  _status: number
  _json: unknown
  _headers: Record<string, string>
  _writes: string[]
} {
  const res = {
    _status: 200,
    _json: null as unknown,
    _headers: {} as Record<string, string>,
    _writes: [] as string[],
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
    writeHead(code: number, headers: Record<string, string>) {
      res._status = code
      res._headers = headers
      return res
    },
    write(chunk: string) {
      res._writes.push(chunk)
      return true
    },
  }
  return res as unknown as NextApiResponse & {
    _status: number
    _json: unknown
    _headers: Record<string, string>
    _writes: string[]
  }
}

describe('/api/v1 external API', () => {
  const originalApiKey = process.env.AITUBERKIT_API_KEY
  const originalPublicApiKey = process.env.NEXT_PUBLIC_AITUBERKIT_API_KEY

  beforeEach(() => {
    jest.resetModules()
    process.env.AITUBERKIT_API_KEY = 'test-api-key'
    process.env.NEXT_PUBLIC_AITUBERKIT_API_KEY = originalPublicApiKey
    require('@/features/api/messageGateway').__resetMessageGatewayForTests()
  })

  afterAll(() => {
    process.env.AITUBERKIT_API_KEY = originalApiKey
    process.env.NEXT_PUBLIC_AITUBERKIT_API_KEY = originalPublicApiKey
  })

  it('requires bearer authentication for v1 endpoints', () => {
    const speak = require('@/pages/api/v1/speak').default
    const res = createMockRes()

    speak(
      createMockReq({
        method: 'POST',
        query: { clientId: 'client1' },
        body: { text: 'hello' },
      }),
      res
    )

    expect(res._status).toBe(401)
    expect(res._json).toEqual({
      error: 'Invalid API key',
      code: 'INVALID_API_KEY',
    })
  })

  it('does not use NEXT_PUBLIC variables as the server API key', () => {
    process.env.AITUBERKIT_API_KEY = ''
    process.env.NEXT_PUBLIC_AITUBERKIT_API_KEY = 'public-api-key'
    jest.resetModules()
    const speak = require('@/pages/api/v1/speak').default
    const res = createMockRes()

    speak(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer public-api-key' },
        query: { clientId: 'client1' },
        body: { text: 'hello' },
      }),
      res
    )

    expect(res._status).toBe(503)
    expect(res._json).toEqual({
      error: 'AITuberKit API key is not configured',
      code: 'API_KEY_NOT_CONFIGURED',
    })
  })

  it('queues speak requests as direct_send messages for the existing receiver', () => {
    const speak = require('@/pages/api/v1/speak').default
    const messages = require('@/pages/api/messages').default

    const speakRes = createMockRes()
    speak(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: {
          text: 'hello from v1',
          emotion: 'happy',
          priority: 'high',
        },
      }),
      speakRes
    )

    expect(speakRes._status).toBe(202)
    expect(speakRes._json).toEqual(
      expect.objectContaining({
        ok: true,
        clientId: 'client1',
        count: 1,
      })
    )

    const getRes = createMockRes()
    messages(
      createMockReq({
        method: 'GET',
        query: { clientId: 'client1' },
      }),
      getRes
    )

    expect(getRes._status).toBe(200)
    expect((getRes._json as { messages: unknown[] }).messages[0]).toEqual(
      expect.objectContaining({
        message: 'hello from v1',
        type: 'direct_send',
        emotion: 'happy',
        priority: 'high',
        source: 'v1',
      })
    )
  })

  it('queues chat requests as user_input by default', () => {
    const chat = require('@/pages/api/v1/chat').default
    const messages = require('@/pages/api/messages').default

    chat(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: { text: 'please respond' },
      }),
      createMockRes()
    )

    const getRes = createMockRes()
    messages(
      createMockReq({
        method: 'GET',
        query: { clientId: 'client1' },
      }),
      getRes
    )

    expect((getRes._json as { messages: unknown[] }).messages[0]).toEqual(
      expect.objectContaining({
        message: 'please respond',
        type: 'user_input',
      })
    )
  })

  it('supports ai_generate chat mode with a custom system prompt', () => {
    const chat = require('@/pages/api/v1/chat').default
    const messages = require('@/pages/api/messages').default

    const res = createMockRes()
    chat(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: {
          messages: ['describe this'],
          mode: 'ai_generate',
          useCurrentSystemPrompt: false,
          systemPrompt: 'Be concise',
        },
      }),
      res
    )

    expect(res._status).toBe(202)

    const getRes = createMockRes()
    messages(
      createMockReq({
        method: 'GET',
        query: { clientId: 'client1' },
      }),
      getRes
    )

    expect((getRes._json as { messages: unknown[] }).messages[0]).toEqual(
      expect.objectContaining({
        type: 'ai_generate',
        systemPrompt: 'Be concise',
        useCurrentSystemPrompt: false,
      })
    )
  })

  it('queues stop commands for the client command poller', () => {
    const stop = require('@/pages/api/v1/stop').default
    const commands = require('@/pages/api/v1/client/commands').default

    const stopRes = createMockRes()
    stop(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: { mode: 'all', reason: 'test' },
      }),
      stopRes
    )

    expect(stopRes._status).toBe(202)

    const commandRes = createMockRes()
    commands(
      createMockReq({
        method: 'GET',
        query: { clientId: 'client1' },
      }),
      commandRes
    )

    expect(commandRes._status).toBe(200)
    expect((commandRes._json as { commands: unknown[] }).commands[0]).toEqual(
      expect.objectContaining({
        command: 'stop',
        mode: 'all',
        reason: 'test',
      })
    )
  })

  it('returns the latest client status and queue summary', () => {
    const statusUpdate = require('@/pages/api/v1/client/status').default
    const status = require('@/pages/api/v1/status').default
    const speak = require('@/pages/api/v1/speak').default

    statusUpdate(
      createMockReq({
        method: 'POST',
        query: { clientId: 'client1' },
        body: {
          connected: true,
          isSpeaking: true,
          chatProcessing: false,
          modelType: 'vrm',
          aiService: 'openai',
          voiceEngine: 'voicevox',
        },
      }),
      createMockRes()
    )

    speak(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: { text: 'queued' },
      }),
      createMockRes()
    )

    const statusRes = createMockRes()
    status(
      createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
      }),
      statusRes
    )

    expect(statusRes._status).toBe(200)
    expect(statusRes._json).toEqual(
      expect.objectContaining({
        ok: true,
        clientId: 'client1',
        status: expect.objectContaining({
          connected: true,
          isSpeaking: true,
          modelType: 'vrm',
        }),
        queue: expect.objectContaining({
          messageCount: 1,
          commandCount: 0,
        }),
      })
    )
  })

  it('returns recent events as a JSON snapshot', () => {
    const speak = require('@/pages/api/v1/speak').default
    const events = require('@/pages/api/v1/events').default

    speak(
      createMockReq({
        method: 'POST',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1' },
        body: { text: 'event source' },
      }),
      createMockRes()
    )

    const eventsRes = createMockRes()
    events(
      createMockReq({
        method: 'GET',
        headers: { authorization: 'Bearer test-api-key' },
        query: { clientId: 'client1', snapshot: 'true' },
      }),
      eventsRes
    )

    expect(eventsRes._status).toBe(200)
    expect(
      (eventsRes._json as { events: Array<{ type: string }> }).events
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'message_queued' }),
      ])
    )
  })
})
