import { Talk } from './messages'
import { MimoTtsModel } from '@/features/constants/settings'

export async function synthesizeVoiceMimoApi(
  talk: Talk,
  apiKey: string,
  model: MimoTtsModel,
  voice: string,
  stylePrompt: string,
  voiceDesignPrompt: string
) {
  try {
    const res = await fetch('/api/mimoTTS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: talk.message,
        apiKey,
        model,
        voice,
        stylePrompt,
        voiceDesignPrompt,
      }),
    })

    if (!res.ok) {
      throw new Error(
        `MiMo APIからの応答が異常です。ステータスコード: ${res.status}`
      )
    }

    return await res.arrayBuffer()
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`MiMo TTSでエラーが発生しました: ${error.message}`)
    }
    throw new Error('MiMo TTSで不明なエラーが発生しました')
  }
}
