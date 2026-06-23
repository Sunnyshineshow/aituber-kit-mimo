/**
 * @jest-environment node
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/mimoTTS'

const mockFetch = jest.fn()
global.fetch = mockFetch

function createMockReq(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'POST',
    body: {},
    ...overrides,
  } as NextApiRequest
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    _body: null as unknown,
    _headers: {} as Record<string, string>,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
    send(data: unknown) {
      res._body = data
      return res
    },
    setHeader(key: string, value: string) {
      res._headers[key] = value
      return res
    },
  }
  return res as unknown as NextApiResponse & {
    _status: number
    _json: unknown
    _body: unknown
    _headers: Record<string, string>
  }
}

describe('/api/mimoTTS', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    jest.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  it('should return 405 for non-POST methods', async () => {
    const req = createMockReq({ method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(405)
    expect(res._json).toEqual({ error: 'Method not allowed' })
  })

  it('should return 400 when required parameters are missing', async () => {
    delete process.env.MIMO_API_KEY
    const req = createMockReq({ body: { message: 'hello', voice: 'Chloe' } })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
  })

  it('should require built-in voice for the built-in model', async () => {
    const req = createMockReq({
      body: {
        message: 'hello',
        apiKey: 'test-key',
        model: 'mimo-v2.5-tts',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Missing MiMo built-in voice' })
  })

  it('should require voice design prompt for the voice design model', async () => {
    const req = createMockReq({
      body: {
        message: 'hello',
        apiKey: 'test-key',
        model: 'mimo-v2.5-tts-voicedesign',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({ error: 'Missing MiMo voice design prompt' })
  })

  it('should call MiMo built-in TTS and return wav audio', async () => {
    const audioBase64 = Buffer.from('fake-audio').toString('base64')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { audio: { data: audioBase64 } } }],
        }),
    })

    const req = createMockReq({
      body: {
        message: 'hello',
        voice: 'Chloe',
        apiKey: 'test-key',
        stylePrompt: 'Speak warmly',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test-key',
        }),
      })
    )

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('mimo-v2.5-tts')
    expect(body.audio).toEqual({ format: 'wav', voice: 'Chloe' })
    expect(body.messages).toEqual([
      { role: 'user', content: 'Speak warmly' },
      { role: 'assistant', content: 'hello' },
    ])
    expect(res._headers['Content-Type']).toBe('audio/wav')
    expect(Buffer.isBuffer(res._body)).toBe(true)
  })

  it('should call MiMo voice design TTS without a built-in voice', async () => {
    const audioBase64 = Buffer.from('fake-audio').toString('base64')
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { audio: { data: audioBase64 } } }],
        }),
    })

    const req = createMockReq({
      body: {
        message: 'hello',
        voice: 'Chloe',
        apiKey: 'test-key',
        model: 'mimo-v2.5-tts-voicedesign',
        voiceDesignPrompt: 'A warm young narrator voice',
        stylePrompt: 'Speak slowly',
      },
    })
    const res = createMockRes()

    await handler(req, res)

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toBe('mimo-v2.5-tts-voicedesign')
    expect(body.audio).toEqual({
      format: 'wav',
      optimize_text_preview: true,
    })
    expect(body.audio.voice).toBeUndefined()
    expect(body.messages).toEqual([
      {
        role: 'user',
        content: 'A warm young narrator voice\n\nSpeak slowly',
      },
      { role: 'assistant', content: 'hello' },
    ])
    expect(res._headers['Content-Type']).toBe('audio/wav')
    expect(Buffer.isBuffer(res._body)).toBe(true)
  })

  it('should fall back to server-side MIMO_API_KEY', async () => {
    process.env.MIMO_API_KEY = 'env-key'
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [
            {
              message: {
                audio: { data: Buffer.from('audio').toString('base64') },
              },
            },
          ],
        }),
    })

    const req = createMockReq({ body: { message: 'hello', voice: 'Chloe' } })
    const res = createMockRes()

    await handler(req, res)

    expect(mockFetch.mock.calls[0][1].headers['api-key']).toBe('env-key')
  })
})
