import { useState, useCallback, useRef, useMemo, ChangeEvent } from 'react'
import { useTranslation } from 'react-i18next'
import settingsStore from '@/features/stores/settings'
import toastStore from '@/features/stores/toast'
import homeStore from '@/features/stores/home'
import { useAudioProcessing } from './useAudioProcessing'
import { SpeakQueue } from '@/features/messages/speakQueue'
import { ensureMimoCompatibleAudioBlob } from '@/utils/audioBlobToWav'

export function useMimoRecognition(onChatProcessStart: (text: string) => void) {
  const { t } = useTranslation()
  const [userMessage, setUserMessage] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const isListeningRef = useRef(false)
  const transcriptRef = useRef('')
  const { startRecording, stopRecording } = useAudioProcessing()

  const processMimoRecognition = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      setIsProcessing(true)

      try {
        const compatibleBlob = await ensureMimoCompatibleAudioBlob(audioBlob)
        const formData = new FormData()
        const mimeType = compatibleBlob.type || 'audio/wav'
        const fileExtension = mimeType.includes('mp3') ? 'mp3' : 'wav'

        formData.append('file', compatibleBlob, `audio.${fileExtension}`)
        formData.append('language', settingsStore.getState().mimoAsrLanguage)

        const mimoApiKey = settingsStore.getState().mimoApiKey
        if (mimoApiKey) {
          formData.append('apiKey', mimoApiKey)
        }

        const response = await fetch('/api/mimoASR', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(
            `MiMo ASR error: ${response.status} - ${errorData.details || errorData.error || 'Unknown error'}`
          )
        }

        const result = await response.json()
        return result.text || ''
      } catch (error) {
        console.error('MiMo transcription error:', error)
        toastStore.getState().addToast({
          message: t('Toasts.MimoSpeechRecognitionError'),
          type: 'error',
          tag: 'mimo-speech-recognition-error',
        })
        return ''
      } finally {
        setIsProcessing(false)
      }
    },
    [t]
  )

  const stopListening = useCallback(async () => {
    isListeningRef.current = false
    setIsListening(false)

    const audioBlob = await stopRecording()

    if (audioBlob) {
      const transcript = await processMimoRecognition(audioBlob)

      if (transcript.trim()) {
        transcriptRef.current = transcript
        onChatProcessStart(transcript)
      } else {
        toastStore.getState().addToast({
          message: t('Toasts.NoSpeechDetected'),
          type: 'info',
          tag: 'no-speech-detected',
        })
      }
    } else {
      toastStore.getState().addToast({
        message: t('Toasts.NoSpeechDetected'),
        type: 'info',
        tag: 'no-speech-detected',
      })
    }
  }, [stopRecording, processMimoRecognition, onChatProcessStart, t])

  const startListening = useCallback(async () => {
    transcriptRef.current = ''
    setUserMessage('')

    const success = await startRecording()

    if (success) {
      isListeningRef.current = true
      setIsListening(true)
    } else {
      toastStore.getState().addToast({
        message: t('Toasts.SpeechRecognitionError'),
        type: 'error',
        tag: 'speech-recognition-error',
      })
    }
  }, [startRecording, t])

  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening()
    } else {
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      startListening()
    }
  }, [startListening, stopListening])

  const handleSendMessage = useCallback(() => {
    if (userMessage.trim()) {
      homeStore.setState({ isSpeaking: false })
      SpeakQueue.stopAll()
      onChatProcessStart(userMessage)
      setUserMessage('')
    }
  }, [userMessage, onChatProcessStart])

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setUserMessage(e.target.value)
    },
    []
  )

  return useMemo(
    () => ({
      userMessage,
      isListening,
      isProcessing,
      silenceTimeoutRemaining: null,
      handleInputChange,
      handleSendMessage,
      toggleListening,
      startListening,
      stopListening,
    }),
    [
      userMessage,
      isListening,
      isProcessing,
      handleInputChange,
      handleSendMessage,
      toggleListening,
      startListening,
      stopListening,
    ]
  )
}
