import type { NextApiRequest, NextApiResponse } from 'next'

const MIMO_API_URL = 'https://api.xiaomimimo.com/v1/chat/completions'
const MIMO_BUILTIN_TTS_MODEL = 'mimo-v2.5-tts'
const MIMO_VOICE_DESIGN_TTS_MODEL = 'mimo-v2.5-tts-voicedesign'
const DEFAULT_STYLE_PROMPT =
  'Speak naturally with a clear, friendly conversational tone.'

type MimoTtsModel =
  | typeof MIMO_BUILTIN_TTS_MODEL
  | typeof MIMO_VOICE_DESIGN_TTS_MODEL

type MimoTtsRequestBody = {
  message?: string
  apiKey?: string
  model?: string
  voice?: string
  stylePrompt?: string
  voiceDesignPrompt?: string
}

type MimoMessage = {
  role: 'user' | 'assistant'
  content: string
}

type MimoAudioRequest = {
  format: 'wav'
  voice?: string
  optimize_text_preview?: boolean
}

type MimoChatCompletionResponse = {
  choices?: Array<{
    message?: {
      audio?: {
        data?: string
      }
    }
  }>
  error?: {
    message?: string
  }
}

const trimValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const normalizeMimoTtsModel = (model: unknown): MimoTtsModel =>
  model === MIMO_VOICE_DESIGN_TTS_MODEL
    ? MIMO_VOICE_DESIGN_TTS_MODEL
    : MIMO_BUILTIN_TTS_MODEL

const buildUserPrompt = (
  model: MimoTtsModel,
  stylePrompt: string,
  voiceDesignPrompt: string
): string => {
  if (model === MIMO_VOICE_DESIGN_TTS_MODEL) {
    return [voiceDesignPrompt, stylePrompt].filter(Boolean).join('\n\n')
  }

  return stylePrompt || DEFAULT_STYLE_PROMPT
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    message,
    apiKey,
    model: rawModel,
    voice: rawVoice,
    stylePrompt: rawStylePrompt,
    voiceDesignPrompt: rawVoiceDesignPrompt,
  } = req.body as MimoTtsRequestBody
  const mimoApiKey = trimValue(apiKey) || process.env.MIMO_API_KEY
  const model = normalizeMimoTtsModel(rawModel)
  const voice = trimValue(rawVoice)
  const stylePrompt = trimValue(rawStylePrompt)
  const voiceDesignPrompt = trimValue(rawVoiceDesignPrompt)

  if (!trimValue(message) || !mimoApiKey) {
    return res.status(400).json({ error: 'Missing required parameters' })
  }

  if (model === MIMO_BUILTIN_TTS_MODEL && !voice) {
    return res.status(400).json({ error: 'Missing MiMo built-in voice' })
  }

  if (model === MIMO_VOICE_DESIGN_TTS_MODEL && !voiceDesignPrompt) {
    return res.status(400).json({ error: 'Missing MiMo voice design prompt' })
  }

  const audio: MimoAudioRequest =
    model === MIMO_VOICE_DESIGN_TTS_MODEL
      ? {
          format: 'wav',
          optimize_text_preview: true,
        }
      : {
          format: 'wav',
          voice,
        }

  const messages: MimoMessage[] = [
    {
      role: 'user',
      content: buildUserPrompt(model, stylePrompt, voiceDesignPrompt),
    },
    {
      role: 'assistant',
      content: trimValue(message),
    },
  ]

  try {
    const response = await fetch(MIMO_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': mimoApiKey,
      },
      body: JSON.stringify({
        model,
        messages,
        audio,
      }),
    })

    const data = (await response.json()) as MimoChatCompletionResponse

    if (!response.ok) {
      throw new Error(
        data.error?.message || `MiMo API returned ${response.status}`
      )
    }

    const audioData = data.choices?.[0]?.message?.audio?.data
    if (!audioData) {
      throw new Error('MiMo response did not include audio data')
    }

    const buffer = Buffer.from(audioData, 'base64')
    res.setHeader('Content-Type', 'audio/wav')
    res.send(buffer)
  } catch (error) {
    console.error('MiMo TTS error:', error)
    res.status(500).json({
      error: 'Failed to generate MiMo speech',
      details: error instanceof Error ? error.message : String(error),
    })
  }
}
