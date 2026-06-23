import type { NextApiRequest, NextApiResponse } from 'next'
import { Buffer } from 'buffer'

const MIMO_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const MIMO_ASR_MODEL = 'mimo-v2.5-asr'
const MAX_AUDIO_BYTES = 7.5 * 1024 * 1024

export const config = {
  api: {
    bodyParser: false,
  },
}

type Part = {
  name: string
  data: Buffer
  filename?: string
  type?: string
}

type MimoChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
  error?: {
    message?: string
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const buffer = await getRawBody(req)
    const contentTypeHeader = req.headers['content-type']
    if (!contentTypeHeader) {
      return res.status(400).json({ error: 'Content-Type header is missing' })
    }

    const boundary = getBoundary(contentTypeHeader)
    if (!boundary) {
      return res
        .status(400)
        .json({ error: 'Could not detect boundary from Content-Type' })
    }

    const parts = parseMultipartData(buffer, boundary)
    const audioFilePart = parts.find((part) => part.name === 'file')
    const languagePart = parts.find((part) => part.name === 'language')
    const apiKeyPart = parts.find((part) => part.name === 'apiKey')

    if (!audioFilePart) {
      return res.status(400).json({ error: 'No audio file provided' })
    }

    const mimeType = (audioFilePart.type || 'audio/wav')
      .split(';')[0]
      .toLowerCase()
    if (!['audio/wav', 'audio/mpeg', 'audio/mp3'].includes(mimeType)) {
      return res.status(400).json({
        error: 'Unsupported audio format',
        details: 'MiMo ASR supports wav and mp3 audio only',
      })
    }

    if (audioFilePart.data.length > MAX_AUDIO_BYTES) {
      return res.status(400).json({
        error: 'Audio file is too large',
        details:
          'MiMo ASR data URL must stay under 10 MB after base64 encoding',
      })
    }

    const mimoApiKey =
      apiKeyPart?.data.toString('utf-8') || process.env.MIMO_API_KEY

    if (!mimoApiKey) {
      return res.status(500).json({ error: 'MiMo API key is not configured' })
    }

    const language = normalizeMimoAsrLanguage(
      languagePart?.data.toString('utf-8')
    )
    const audioBase64 = audioFilePart.data.toString('base64')

    const response = await fetch(MIMO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': mimoApiKey,
      },
      body: JSON.stringify({
        model: MIMO_ASR_MODEL,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: `data:${mimeType};base64,${audioBase64}`,
                },
              },
            ],
          },
        ],
        asr_options: {
          language,
        },
      }),
    })

    const data = (await response.json()) as MimoChatCompletionResponse

    if (!response.ok) {
      throw new Error(
        data.error?.message || `MiMo API returned ${response.status}`
      )
    }

    const text = data.choices?.[0]?.message?.content || ''
    return res.status(200).json({ text })
  } catch (error: any) {
    console.error('MiMo ASR error:', error)
    return res.status(500).json({
      error: 'Failed to process MiMo audio',
      details: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    })
  }
}

const normalizeMimoAsrLanguage = (language?: string) => {
  if (language === 'zh' || language === 'en') {
    return language
  }
  return 'auto'
}

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []

    req.on('data', (chunk) => {
      chunks.push(chunk)
    })

    req.on('end', () => {
      resolve(Buffer.concat(chunks))
    })

    req.on('error', (err) => {
      reject(err)
    })
  })
}

function getBoundary(contentType: string): string | null {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  return boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null
}

function parseMultipartData(buffer: Buffer, boundary: string): Part[] {
  const delimiter = Buffer.from(`--${boundary}\r\n`)
  const parts: Part[] = []
  let position = buffer.indexOf(delimiter)

  if (position === -1) return parts
  position += delimiter.length

  while (position < buffer.length) {
    const nextDelimiter = buffer.indexOf(`--${boundary}`, position)
    if (nextDelimiter === -1) break

    const headerEnd = buffer.indexOf('\r\n\r\n', position)
    if (headerEnd === -1 || headerEnd > nextDelimiter) break

    const headerString = buffer.slice(position, headerEnd).toString('utf-8')
    const headers = parseHeaders(headerString)
    const contentDisposition = headers['content-disposition'] || ''
    const nameMatch = contentDisposition.match(/name="([^"]+)"/)
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
    const body = buffer.slice(headerEnd + 4, nextDelimiter - 2)

    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      data: body,
      filename: filenameMatch ? filenameMatch[1] : undefined,
      type: headers['content-type'],
    })

    position = nextDelimiter + delimiter.length
  }

  return parts
}

function parseHeaders(headerString: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const lines = headerString.split('\r\n')

  for (const line of lines) {
    const [key, value] = line.split(': ')
    if (key && value) {
      headers[key.toLowerCase()] = value
    }
  }

  return headers
}
