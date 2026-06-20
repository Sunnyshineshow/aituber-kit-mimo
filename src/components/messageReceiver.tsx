import { useEffect, useState, useCallback } from 'react'
import {
  speakMessageHandler,
  processAIResponse,
  handleSendChatFn,
} from '@/features/chat/handlers'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { Message } from '@/features/messages/messages'
import { useRestrictedMode } from '@/hooks/useRestrictedMode'
import { SpeakQueue } from '@/features/messages/speakQueue'

class ReceivedMessage {
  timestamp: number
  message: string
  type: 'direct_send' | 'ai_generate' | 'user_input'
  systemPrompt?: string
  useCurrentSystemPrompt?: boolean
  image?: string

  constructor(
    timestamp: number,
    message: string,
    type: 'direct_send' | 'ai_generate' | 'user_input',
    systemPrompt?: string,
    useCurrentSystemPrompt?: boolean,
    image?: string
  ) {
    this.timestamp = timestamp
    this.message = message
    this.type = type
    this.systemPrompt = systemPrompt
    this.useCurrentSystemPrompt = useCurrentSystemPrompt
    this.image = image
  }
}

type ReceivedCommand = {
  id: string
  command: 'stop'
  mode: 'speech' | 'queue' | 'all'
  reason?: string
}

const MessageReceiver = () => {
  const [lastTimestamp, setLastTimestamp] = useState(0)
  const clientId = settingsStore((state) => state.clientId)
  const { isRestrictedMode } = useRestrictedMode()
  const handleSendChat = handleSendChatFn()

  const speakMessage = useCallback(
    async (messages: ReceivedMessage[]) => {
      const hs = homeStore.getState()
      const ss = settingsStore.getState()

      for (const message of messages) {
        switch (message.type) {
          case 'direct_send':
            await speakMessageHandler(message.message)
            break
          case 'ai_generate': {
            // 外部画像が提供された場合はそれを使用、なければカメラキャプチャ
            let capturedImage = message.image || ''

            if (!capturedImage) {
              const CAPTURE_TIMEOUT = 10000 // 10秒のタイムアウト

              try {
                // キャプチャをトリガー
                if (!hs.modalImage) {
                  homeStore.setState({ triggerShutter: true })
                }

                // webcamStatusまたはcaptureStatusがtrueの場合、画像が取得されるまで待機
                if (hs.webcamStatus || hs.captureStatus) {
                  // 画像が取得されるまで待つ
                  let checkImage: ReturnType<typeof setInterval> | undefined
                  capturedImage = await Promise.race([
                    new Promise<string>((resolve) => {
                      checkImage = setInterval(() => {
                        const currentModalImage =
                          homeStore.getState().modalImage
                        if (currentModalImage) {
                          clearInterval(checkImage)
                          resolve(currentModalImage)
                        }
                      }, 100)
                    }),
                    new Promise<string>((_, reject) =>
                      setTimeout(() => {
                        if (checkImage) clearInterval(checkImage)
                        reject(new Error('Image capture timeout'))
                      }, CAPTURE_TIMEOUT)
                    ),
                  ])
                } else {
                  // 既存の modalImage があれば使用
                  capturedImage = hs.modalImage || ''
                }
              } catch (error) {
                console.error('Failed to capture image:', error)
                // エラー時は画像なしで続行
                capturedImage = ''
              }
            }

            const conversationHistory = [
              ...hs.chatLog.slice(-10),
              { role: 'user', content: message.message },
            ]
              .map((m) => `${m.role}: ${m.content}`)
              .join('\n')
            const systemPrompt = message.useCurrentSystemPrompt
              ? ss.systemPrompt
              : message.systemPrompt
            const messages: Message[] = [
              {
                role: 'system',
                content: systemPrompt?.replace(
                  '[conversation_history]',
                  conversationHistory
                ),
              },
              {
                role: 'user',
                content: capturedImage
                  ? [
                      { type: 'text', text: message.message },
                      { type: 'image', image: capturedImage },
                    ]
                  : message.message,
              },
            ]

            // 画像を使用した後にクリア
            if (capturedImage) {
              homeStore.setState({ modalImage: '' })
            }

            await processAIResponse(messages)
            break
          }
          case 'user_input': {
            if (message.image) {
              // 外部画像をmodalImageにセット
              homeStore.setState({ modalImage: message.image })
            } else {
              const CAPTURE_TIMEOUT = 10000 // 10秒のタイムアウト

              try {
                // キャプチャをトリガー
                if (!hs.modalImage) {
                  homeStore.setState({ triggerShutter: true })
                }

                // webcamStatusまたはcaptureStatusがtrueの場合、画像が取得されるまで待機
                if (hs.webcamStatus || hs.captureStatus) {
                  // 画像が取得されるまで待つ
                  let checkImage: ReturnType<typeof setInterval> | undefined
                  await Promise.race([
                    new Promise<string>((resolve) => {
                      checkImage = setInterval(() => {
                        const currentModalImage =
                          homeStore.getState().modalImage
                        if (currentModalImage) {
                          clearInterval(checkImage)
                          resolve(currentModalImage)
                        }
                      }, 100)
                    }),
                    new Promise<string>((_, reject) =>
                      setTimeout(() => {
                        if (checkImage) clearInterval(checkImage)
                        reject(new Error('Image capture timeout'))
                      }, CAPTURE_TIMEOUT)
                    ),
                  ])
                }
              } catch (error) {
                console.error('Failed to capture image:', error)
              }
            }

            // handleSendChatFnを使用してメッセージを送信
            await handleSendChat(message.message)
            break
          }
          default:
            console.error('Invalid message type:', message.type)
        }
      }
    },
    [handleSendChat]
  )

  useEffect(() => {
    if (!clientId || isRestrictedMode) return

    const reportStatus = async () => {
      const hs = homeStore.getState()
      const ss = settingsStore.getState()

      try {
        await fetch(`/api/v1/client/status/?clientId=${clientId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            connected: true,
            isSpeaking: hs.isSpeaking,
            chatProcessing: hs.chatProcessing,
            messageReceiverEnabled: ss.messageReceiverEnabled,
            modelType: ss.modelType,
            aiService: ss.selectAIService,
            voiceEngine: ss.selectVoice,
            externalLinkageMode: ss.externalLinkageMode,
          }),
        })
      } catch (error) {
        console.error('Error reporting client status:', error)
      }
    }

    const fetchCommands = async () => {
      try {
        const response = await fetch(
          `/api/v1/client/commands/?clientId=${clientId}`
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        const commands = (data.commands || []) as ReceivedCommand[]
        const stopCommands = commands.filter(
          (command) => command.command === 'stop'
        )

        for (const command of stopCommands) {
          if (command.mode === 'speech') {
            SpeakQueue.stopCurrentSpeech()
          } else if (command.mode === 'queue') {
            SpeakQueue.stopQueue()
          } else {
            SpeakQueue.stopAll()
            homeStore.setState({ chatProcessing: false, isSpeaking: false })
          }
        }

        if (stopCommands.length > 0) {
          await reportStatus()
        }
      } catch (error) {
        console.error('Error fetching commands:', error)
      }
    }

    const fetchMessages = async () => {
      try {
        const response = await fetch(
          `/api/messages/?lastTimestamp=${lastTimestamp}&clientId=${clientId}`
        )
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        if (data.messages && data.messages.length > 0) {
          speakMessage(data.messages)
          const newLastTimestamp =
            data.messages[data.messages.length - 1].timestamp
          setLastTimestamp(newLastTimestamp)
        }
      } catch (error) {
        console.error('Error fetching messages:', error)
      }
    }

    let isFetchingMessages = false
    let isFetchingCommands = false
    let isReportingStatus = false

    const safeFetchMessages = async () => {
      if (isFetchingMessages) return
      isFetchingMessages = true
      try {
        await fetchMessages()
      } finally {
        isFetchingMessages = false
      }
    }

    const safeFetchCommands = async () => {
      if (isFetchingCommands) return
      isFetchingCommands = true
      try {
        await fetchCommands()
      } finally {
        isFetchingCommands = false
      }
    }

    const safeReportStatus = async () => {
      if (isReportingStatus) return
      isReportingStatus = true
      try {
        await reportStatus()
      } finally {
        isReportingStatus = false
      }
    }

    void safeFetchMessages()
    void safeFetchCommands()
    void safeReportStatus()
    const intervalId = setInterval(() => void safeFetchMessages(), 1000)
    const commandIntervalId = setInterval(() => void safeFetchCommands(), 1000)
    const statusIntervalId = setInterval(() => void safeReportStatus(), 2000)

    return () => {
      clearInterval(intervalId)
      clearInterval(commandIntervalId)
      clearInterval(statusIntervalId)
    }
  }, [clientId, isRestrictedMode, lastTimestamp, speakMessage])

  return <></>
}

export default MessageReceiver
