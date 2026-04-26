import { getAIChatResponseStream } from '@/features/chat/aiChatFactory'
import type { AIChatResponseStreamOptions } from '@/features/chat/aiChatFactory'
import { THINKING_MARKER } from '@/features/chat/vercelAIChat'
import { Message, EmotionType, EMOTIONS } from '@/features/messages/messages'
import settingsStore from '@/features/stores/settings'

/**
 * 実況履歴エントリ（実況テキスト + 情景描写）
 */
export interface CommentaryHistoryEntry {
  commentary: string
  sceneDescription: string
}

export interface BackgroundSceneAnalysisEntry {
  summary: string
}

export function buildGameCommentaryMessages(
  commentaryHistory: CommentaryHistoryEntry[],
  imageData: string,
  recentChatMessages?: Array<{ role: string; content: string }>,
  backgroundSceneAnalyses: BackgroundSceneAnalysisEntry[] = []
): Message[] {
  const ss = settingsStore.getState()
  const characterPrompt = ss.systemPrompt || ''
  const commentaryPrompt = ss.gameCommentaryPromptTemplate || ''

  const systemPrompt = characterPrompt + '\n\n' + commentaryPrompt
  const messages: Message[] = [{ role: 'system', content: systemPrompt }]

  if (recentChatMessages && recentChatMessages.length > 0) {
    for (const msg of recentChatMessages) {
      messages.push({ role: msg.role, content: msg.content })
    }
  }

  for (const history of commentaryHistory) {
    if (history.sceneDescription) {
      messages.push({
        role: 'user',
        content: `[前回の画面状況] ${history.sceneDescription}`,
      })
    }
    messages.push({ role: 'assistant', content: history.commentary })
  }

  if (backgroundSceneAnalyses.length > 0) {
    messages.push({
      role: 'user',
      content: `[発話中の補助的な画面解析メモ・古い順]\n${backgroundSceneAnalyses
        .map((analysis, index) => `${index + 1}. ${analysis.summary}`)
        .join('\n')}`,
    })
  }

  messages.push({
    role: 'user',
    content: [
      { type: 'text', text: '画面の状況を実況してください。' },
      { type: 'image', image: imageData },
    ],
  })

  return messages
}

/**
 * ゲーム実況コメントを生成する
 *
 * キャラクターのシステムプロンプト + 実況プロンプトテンプレートを組み合わせ、
 * 画面キャプチャ画像と実況履歴を基にAIがコメントを生成する。
 * 情景描写（sceneDescription）も同時に生成し、次回以降の文脈として活用する。
 */
export async function generateGameCommentary(
  commentaryHistory: CommentaryHistoryEntry[],
  imageData: string,
  recentChatMessages?: Array<{ role: string; content: string }>,
  backgroundSceneAnalyses: BackgroundSceneAnalysisEntry[] = [],
  options: AIChatResponseStreamOptions = {}
): Promise<{
  text: string
  emotion: EmotionType
  sceneDescription: string
} | null> {
  const messages = buildGameCommentaryMessages(
    commentaryHistory,
    imageData,
    recentChatMessages,
    backgroundSceneAnalyses
  )

  try {
    const stream = await getAIChatResponseStream(messages, options)
    if (!stream) return null

    const reader = stream.getReader()
    let fullText = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value && !value.startsWith(THINKING_MARKER)) {
          fullText += value
        }
      }
    } finally {
      reader.releaseLock()
    }

    fullText = fullText.trim()
    if (!fullText) return null

    return parseCommentaryResponse(fullText)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null
    }

    console.error('ゲーム実況コメント生成エラー:', error)
    return null
  }
}

/**
 * AI応答から感情タグ、実況テキスト、情景描写を解析する
 *
 * 期待フォーマット:
 *   [emotion]実況セリフ
 *   [scene]情景描写テキスト
 *
 * [scene]がない場合は空文字列を返す（後方互換性）
 */
export function parseCommentaryResponse(rawText: string): {
  text: string
  emotion: EmotionType
  sceneDescription: string
} {
  // [scene]タグで分割
  const sceneMatch = rawText.match(/\[scene\]([\s\S]*)$/i)
  const sceneDescription = sceneMatch?.[1]?.trim() || ''

  // [scene]より前の部分を実況テキストとして扱う
  const commentaryPart = sceneMatch
    ? rawText.slice(0, rawText.indexOf(sceneMatch[0])).trim()
    : rawText.trim()

  // 感情タグの解析
  const emotionMatch = commentaryPart.match(/^\s*\[(.*?)\]/)

  if (emotionMatch?.[1]) {
    const emotionStr = emotionMatch[1].toLowerCase()
    const emotion: EmotionType = (EMOTIONS as readonly string[]).includes(
      emotionStr
    )
      ? (emotionStr as EmotionType)
      : 'neutral'
    const sliceStart =
      commentaryPart.indexOf(emotionMatch[0]) + emotionMatch[0].length
    const text = commentaryPart
      .slice(sliceStart)
      .replace(/\[.*?\]/g, '')
      .trim()

    return {
      text: text || commentaryPart.replace(/\[.*?\]/g, '').trim(),
      emotion,
      sceneDescription,
    }
  }

  return {
    text: commentaryPart.replace(/\[.*?\]/g, '').trim(),
    emotion: 'neutral',
    sceneDescription,
  }
}
