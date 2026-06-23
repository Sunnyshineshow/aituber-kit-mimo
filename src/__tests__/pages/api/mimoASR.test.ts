/**
 * @jest-environment node
 */

import { Readable } from 'stream'
import type { NextApiRequest, NextApiResponse } from 'next'
import handler from '@/pages/api/mimoASR'

const mockFetch = jest.fn()
global.fetch = mockFetch

function createMultipartBody(
  boundary: string,
  parts: Array<{
    name: string
    value: Buffer | string
    filename?: string
    contentType?: string
  }>
) {
  const chunks: Buffer[] = []

  for (const part of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`))
    const filename = part.filename ? `; filename="${part.filename}"` : ''
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${part.name}"${filename}\r\n`
      )
    )
    if (part.contentType) {
      chunks.push(Buffer.from(`Content-Type: ${part.contentType}\r\n`))
    }
    chunks.push(Buffer.from('\r\n'))
    chunks.push(
      Buffer.isBuffer(part.value) ? part.value : Buffer.from(part.value)
    )
    chunks.push(Buffer.from('\r\n'))
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`))
  return Buffer.concat(chunks)
}

function createMockReq(
  body: Buffer,
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return Object.assign(Readable.from([body]), {
    method: 'POST',
    headers: {},
    ...overrides,
  }) as NextApiRequest
}

function createMockRes() {
  const res = {
    _status: 200,
    _json: null as unknown,
    status(code: number) {
      res._status = code
      return res
    },
    json(data: unknown) {
      res._json = data
      return res
    },
  }
  return res as unknown as NextApiResponse & {
    _status: number
    _json: unknown
  }
}

describe('/api/mimoASR', () => {
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
    const req = createMockReq(Buffer.from(''), { method: 'GET' })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(405)
    expect(res._json).toEqual({ error: 'Method not allowed' })
  })

  it('should call MiMo ASR with wav data URL and return text', async () => {
    const boundary = '----test-boundary'
    const audioBuffer = Buffer.from('fake-wav')
    const body = createMultipartBody(boundary, [
      {
        name: 'file',
        filename: 'audio.wav',
        contentType: 'audio/wav',
        value: audioBuffer,
      },
      { name: 'language', value: 'en' },
      { name: 'apiKey', value: 'test-key' },
    ])
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          choices: [{ message: { content: 'hello world' } }],
        }),
    })

    const req = createMockReq(body, {
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
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

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(requestBody.model).toBe('mimo-v2.5-asr')
    expect(requestBody.asr_options).toEqual({ language: 'en' })
    expect(requestBody.messages[0].content[0].input_audio.data).toBe(
      `data:audio/wav;base64,${audioBuffer.toString('base64')}`
    )
    expect(res._status).toBe(200)
    expect(res._json).toEqual({ text: 'hello world' })
  })

  it('should reject unsupported audio formats', async () => {
    const boundary = '----test-boundary'
    const body = createMultipartBody(boundary, [
      {
        name: 'file',
        filename: 'audio.webm',
        contentType: 'audio/webm',
        value: Buffer.from('webm'),
      },
      { name: 'apiKey', value: 'test-key' },
    ])
    const req = createMockReq(body, {
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
    })
    const res = createMockRes()

    await handler(req, res)

    expect(res._status).toBe(400)
    expect(res._json).toEqual({
      error: 'Unsupported audio format',
      details: 'MiMo ASR supports wav and mp3 audio only',
    })
    expect(mockFetch).not.toHaveBeenCalled()
  })
})
