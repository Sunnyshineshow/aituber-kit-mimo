import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Image from 'next/image'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import slideStore from '@/features/stores/slide'
import { isMultiModalAvailable } from '@/features/constants/aiModels'
import { IconButton } from './iconButton'
import { useKioskMode } from '@/hooks/useKioskMode'

// ファイルバリデーションの設定
const FILE_VALIDATION = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  allowedTypes: [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',
  ],
  maxImageDimensions: { width: 4096, height: 4096 },
} as const

type Props = {
  userMessage: string
  isMicRecording: boolean
  onChangeUserMessage: (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => void
  onClickSendButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClickMicButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  onClickStopButton: (event: React.MouseEvent<HTMLButtonElement>) => void
  isSpeaking: boolean
  silenceTimeoutRemaining: number | null
  continuousMicListeningMode: boolean
  onToggleContinuousMode: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export const MessageInput = ({
  userMessage,
  isMicRecording,
  onChangeUserMessage,
  onClickMicButton,
  onClickSendButton,
  onClickStopButton,
  isSpeaking,
  silenceTimeoutRemaining,
  continuousMicListeningMode,
}: Props) => {
  const chatProcessing = homeStore((s) => s.chatProcessing)
  const slidePlaying = slideStore((s) => s.isPlaying)
  const modalImage = homeStore((s) => s.modalImage)
  const selectAIService = settingsStore((s) => s.selectAIService)
  const selectAIModel = settingsStore((s) => s.selectAIModel)
  const imageDisplayPosition = settingsStore((s) => s.imageDisplayPosition)
  const enableMultiModal = settingsStore((s) => s.enableMultiModal)
  const customModel = settingsStore((s) => s.customModel)
  const [rows, setRows] = useState(1)
  const [loadingDots, setLoadingDots] = useState('')
  const [showPermissionModal, setShowPermissionModal] = useState(false)
  const [fileError, setFileError] = useState<string>('')
  const [showImageActions, setShowImageActions] = useState(false)
  const [inputValidationError, setInputValidationError] = useState<string>('')
  const [isSmallScreen, setIsSmallScreen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const realtimeAPIMode = settingsStore((s) => s.realtimeAPIMode)
  const showSilenceProgressBar = settingsStore((s) => s.showSilenceProgressBar)

  const { t } = useTranslation()

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 640px)')
    setIsSmallScreen(!mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsSmallScreen(!e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Kiosk mode input validation
  const { isKioskMode, validateInput, maxInputLength } = useKioskMode()

  // マルチモーダル対応かどうかを判定
  const isMultiModalSupported = isMultiModalAvailable(
    selectAIService,
    selectAIModel,
    enableMultiModal,
    customModel
  )

  // アイコン表示の条件
  const showIconDisplay = modalImage && imageDisplayPosition === 'icon'

  useEffect(() => {
    if (chatProcessing) {
      const interval = setInterval(() => {
        setLoadingDots((prev) => {
          if (prev === '...') return ''
          return prev + '.'
        })
      }, 200)

      return () => clearInterval(interval)
    } else {
      if (textareaRef.current) {
        textareaRef.current.value = ''
        const isTouchDevice = () => {
          if (typeof window === 'undefined') return false
          return (
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            // @ts-expect-error: msMaxTouchPoints is IE-specific
            navigator.msMaxTouchPoints > 0
          )
        }
        if (!isTouchDevice()) {
          textareaRef.current.focus()
        }
      }
    }
  }, [chatProcessing])

  // テキスト内容に基づいて適切な行数を計算
  const calculateRows = useCallback((text: string): number => {
    const MIN_ROWS = 1
    const MAX_ROWS = 5 // 最大行数を制限（UIの見栄えを考慮して調整）
    const CHARS_PER_LINE = 50 // 平均的な1行の文字数（概算）
    const lines = text.split('\n')

    // 各行の幅を考慮してテキストの折り返しを計算
    // 簡単な実装では改行文字の数 + 1を使用
    const baseRows = Math.max(MIN_ROWS, lines.length)

    // 長い行がある場合、追加の行を考慮（おおよその計算）
    const extraRows = lines.reduce((acc, line) => {
      const lineRows = Math.ceil(line.length / CHARS_PER_LINE)
      return acc + Math.max(0, lineRows - 1)
    }, 0)

    return Math.min(MAX_ROWS, baseRows + extraRows)
  }, [])

  // userMessageの変更に応じて行数を調整
  useEffect(() => {
    const newRows = calculateRows(userMessage)
    setRows(newRows)
  }, [userMessage, calculateRows])

  // 共通の遅延行数更新処理
  const updateRowsWithDelay = useCallback(
    (target: HTMLTextAreaElement) => {
      setTimeout(() => {
        const newRows = calculateRows(target.value)
        setRows(newRows)
      }, 0)
    },
    [calculateRows]
  )

  // テキストエリアの内容変更時の処理
  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value
    const newRows = calculateRows(newText)
    setRows(newRows)
    onChangeUserMessage(event)
  }

  // ファイルバリデーション関数
  const validateFile = useCallback(
    (file: File): { isValid: boolean; error?: string } => {
      // ファイルサイズチェック
      if (file.size > FILE_VALIDATION.maxSizeBytes) {
        return {
          isValid: false,
          error: t('FileSizeError', {
            maxSize: Math.round(FILE_VALIDATION.maxSizeBytes / (1024 * 1024)),
          }),
        }
      }

      // ファイルタイプチェック
      if (!FILE_VALIDATION.allowedTypes.includes(file.type as any)) {
        return {
          isValid: false,
          error: t('FileTypeError'),
        }
      }

      return { isValid: true }
    },
    [t]
  )

  // 画像の寸法をチェックする関数
  const validateImageDimensions = useCallback(
    (imageElement: HTMLImageElement): boolean => {
      return (
        imageElement.naturalWidth <= FILE_VALIDATION.maxImageDimensions.width &&
        imageElement.naturalHeight <= FILE_VALIDATION.maxImageDimensions.height
      )
    },
    []
  )

  // 画像を処理する関数
  const processImageFile = useCallback(
    async (file: File): Promise<void> => {
      setFileError('')

      const validation = validateFile(file)
      if (!validation.isValid) {
        setFileError(validation.error || 'Unknown error')
        return
      }

      try {
        const reader = new FileReader()
        reader.onload = (e) => {
          const base64Image = e.target?.result as string

          // 画像の寸法チェック（オプション）
          const img = document.createElement('img')
          img.onload = () => {
            if (!validateImageDimensions(img)) {
              setFileError(
                t('ImageDimensionError', {
                  maxWidth: FILE_VALIDATION.maxImageDimensions.width,
                  maxHeight: FILE_VALIDATION.maxImageDimensions.height,
                })
              )
              return
            }
            homeStore.setState({ modalImage: base64Image })
          }
          img.onerror = () => {
            setFileError(t('ImageLoadError'))
          }
          img.src = base64Image
        }
        reader.onerror = () => {
          setFileError(t('FileReadError'))
        }
        reader.readAsDataURL(file)
      } catch (error) {
        setFileError(t('FileProcessError'))
      }
    },
    [validateFile, validateImageDimensions, t]
  )

  // 画像を削除する関数
  const handleRemoveImage = useCallback(() => {
    homeStore.setState({ modalImage: '' })
    setFileError('')
  }, [])

  // クリップボードからの画像ペースト処理
  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      if (!isMultiModalSupported) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
        return
      }

      const clipboardData = event.clipboardData
      if (!clipboardData) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
        return
      }

      const items = clipboardData.items
      let hasImage = false

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          event.preventDefault()
          const file = item.getAsFile()
          if (file) {
            await processImageFile(file)
            hasImage = true
          }
          break
        }
      }

      // 画像がない場合のみ通常のペースト処理を実行
      if (!hasImage) {
        updateRowsWithDelay(event.target as HTMLTextAreaElement)
      }
    },
    [isMultiModalSupported, processImageFile, updateRowsWithDelay]
  )

  // ドラッグ＆ドロップ処理
  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!isMultiModalSupported) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
    },
    [isMultiModalSupported]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      if (!isMultiModalSupported) {
        return
      }
      event.preventDefault()
      event.stopPropagation()

      const files = event.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        if (file.type.startsWith('image/')) {
          await processImageFile(file)
        } else {
          setFileError(t('FileTypeError'))
        }
      }
    },
    [isMultiModalSupported, processImageFile, t]
  )

  // Validate input and handle send with kiosk mode restrictions
  const handleValidatedSend = useCallback(
    (event: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent) => {
      if (userMessage.trim() === '') return false

      // Validate input in kiosk mode
      if (isKioskMode) {
        const validation = validateInput(userMessage)
        if (!validation.valid) {
          setInputValidationError(validation.reason || t('Kiosk.InputInvalid'))
          return false
        }
      }

      // Clear any previous validation errors
      setInputValidationError('')
      return true
    },
    [userMessage, isKioskMode, validateInput, t]
  )

  const handleKeyPress = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      // IME 文字変換中を除外しつつ、半角/全角キー（Backquote）による IME トグルは無視
      !event.nativeEvent.isComposing &&
      event.code !== 'Backquote' &&
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault() // デフォルトの挙動を防止
      if (userMessage.trim() !== '') {
        // Validate before sending
        if (
          handleValidatedSend(
            event as unknown as React.MouseEvent<HTMLButtonElement>
          )
        ) {
          onClickSendButton(
            event as unknown as React.MouseEvent<HTMLButtonElement>
          )
          setRows(1)
        }
      }
    } else if (event.key === 'Enter' && event.shiftKey) {
      // Shift+Enterの場合、calculateRowsで自動計算されるため、手動で行数を増やす必要なし
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    } else if (
      event.key === 'Backspace' &&
      rows > 1 &&
      userMessage.slice(-1) === '\n'
    ) {
      // Backspaceの場合も、calculateRowsで自動計算されるため、手動で行数を減らす必要なし
      updateRowsWithDelay(event.target as HTMLTextAreaElement)
    }
  }

  // Handle send button click with validation
  const handleSendClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (handleValidatedSend(event)) {
        onClickSendButton(event)
      }
    },
    [handleValidatedSend, onClickSendButton]
  )

  const handleMicClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClickMicButton(event)
  }

  return (
    <div className="absolute bottom-0 z-20 w-screen">
      {showPermissionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="theme-surface-elevated max-w-[calc(100vw-2rem)] rounded-xl border p-4 text-theme-default shadow-xl backdrop-blur-md sm:max-w-md sm:p-6">
            <h3 className="text-lg sm:text-xl font-bold mb-4">
              {t('MicrophonePermission')}
            </h3>
            <p className="mb-4">{t('MicrophonePermissionMessage')}</p>
            <button
              className="rounded-lg bg-secondary px-4 py-2 font-bold text-theme transition-colors hover:bg-secondary-hover"
              onClick={() => setShowPermissionModal(false)}
            >
              {t('Close')}
            </button>
          </div>
        </div>
      )}
      <div className="text-theme-default">
        <div className="mx-auto max-w-4xl px-3 pb-2 pt-2 sm:px-4 sm:pb-4">
          <div className="theme-surface-dock rounded-xl border p-1.5 backdrop-blur-md sm:p-2">
            {/* プログレスバー - 設定に基づいて表示/非表示 */}
            {isMicRecording && showSilenceProgressBar && (
              <div className="theme-surface-soft mb-2 h-2 w-full overflow-hidden rounded-full border">
                <div
                  className="h-full rounded-full bg-secondary transition-all duration-200 ease-linear"
                  style={{
                    // プログレスバーの幅計算 - 最初と最後の0.3秒は表示しない
                    width:
                      silenceTimeoutRemaining !== null
                        ? `${Math.min(
                            100,
                            Math.max(
                              0,
                              ((settingsStore.getState().noSpeechTimeout *
                                1000 -
                                silenceTimeoutRemaining -
                                300) /
                                (settingsStore.getState().noSpeechTimeout *
                                  1000 -
                                  600)) *
                                100
                            )
                          )}%`
                        : '0%',
                  }}
                ></div>
              </div>
            )}
            {/* エラーメッセージ表示 */}
            {fileError && (
              <div className="mb-2 rounded-2xl border border-red-200 bg-red-50/90 p-2 text-sm font-medium text-red-700 shadow-sm">
                {fileError}
              </div>
            )}
            {/* 入力バリデーションエラー表示 (Kiosk mode) */}
            {inputValidationError && (
              <div className="mb-2 rounded-2xl border border-red-200 bg-red-50/90 p-2 text-sm font-medium text-red-700 shadow-sm">
                {inputValidationError}
              </div>
            )}
            {/* 画像プレビュー - 入力欄表示設定の場合のみ */}
            {modalImage && imageDisplayPosition === 'input' && (
              <div
                className="theme-surface-control relative mb-2 rounded-lg border p-2 shadow-inner"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <button
                  onClick={handleRemoveImage}
                  className="theme-surface-control absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border text-sm font-medium text-secondary shadow-sm transition-colors hover:text-secondary-hover"
                >
                  ×
                </button>
                <Image
                  src={modalImage}
                  alt="Pasted image"
                  width={0}
                  height={0}
                  sizes="100vw"
                  className="h-auto max-h-32 w-auto max-w-full rounded-xl object-contain"
                />
              </div>
            )}

            <div className="flex items-end gap-1.5 sm:gap-2">
              <div className="flex-shrink-0 pb-[0.2rem]">
                <IconButton
                  iconName={
                    continuousMicListeningMode ? '24/Close' : '24/Microphone'
                  }
                  backgroundColor={
                    continuousMicListeningMode
                      ? isMicRecording
                        ? 'bg-green-500 text-theme'
                        : 'bg-green-600 text-theme'
                      : undefined
                  }
                  isProcessing={isMicRecording}
                  isProcessingIcon={
                    continuousMicListeningMode ? '24/Microphone' : '24/PauseAlt'
                  }
                  disabled={
                    continuousMicListeningMode || chatProcessing || isSpeaking
                  }
                  onClick={handleMicClick}
                  className="!min-h-10 !min-w-10 !rounded-xl !border !border-white/35 !p-2 shadow-md shadow-primary/10 ring-0 transition-colors duration-200 focus:outline-none focus-visible:outline-none focus-visible:ring-0 sm:!min-h-[44px] sm:!min-w-[44px]"
                />
              </div>
              <div className="flex-1 relative">
                {/* 画像添付インジケーター - アイコンのみ表示設定の場合 */}
                {showIconDisplay && (
                  <div className="absolute left-3 top-3 z-10">
                    <div
                      className="relative cursor-pointer"
                      onMouseEnter={() => setShowImageActions(true)}
                      onMouseLeave={() => setShowImageActions(false)}
                      onFocus={() => setShowImageActions(true)}
                      onBlur={() => setShowImageActions(false)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setShowImageActions(true)
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={t('RemoveImage')}
                    >
                      <svg
                        className="h-4 w-4 text-text-primary"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                        />
                      </svg>
                      {showImageActions && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveImage()
                            setShowImageActions(false)
                          }}
                          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-theme transition-colors hover:bg-red-600"
                          title={t('RemoveImage')}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  data-testid="chat-message-input"
                  placeholder={
                    chatProcessing
                      ? `${t('AnswerGenerating')}${loadingDots}`
                      : continuousMicListeningMode && isMicRecording
                        ? t('ListeningContinuously')
                        : isMultiModalSupported && !isSmallScreen
                          ? `${t('EnterYourQuestion')} (${t('PasteImageSupported') || 'Paste image supported'})`
                          : t('EnterYourQuestion')
                  }
                  onChange={handleTextChange}
                  onPaste={handlePaste}
                  onKeyDown={handleKeyPress}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  disabled={chatProcessing || slidePlaying || realtimeAPIMode}
                  className="theme-surface-control w-full rounded-xl border px-4 text-sm font-bold text-theme-default outline-none transition-all duration-200 placeholder:text-text-primary disabled:bg-primary-disabled disabled:text-primary-disabled sm:text-base"
                  value={userMessage}
                  rows={rows}
                  maxLength={maxInputLength}
                  style={{
                    lineHeight: '1.5',
                    padding: showIconDisplay ? '7px 14px 7px 32px' : '7px 14px',
                    resize: 'none',
                    whiteSpace: 'pre-wrap',
                  }}
                ></textarea>
              </div>
              <div className="flex flex-shrink-0 gap-1.5 pb-[0.2rem] sm:gap-2">
                <IconButton
                  iconName="24/Send"
                  className="!min-h-10 !min-w-10 !rounded-xl !border !border-white/35 !p-2 bg-secondary shadow-md shadow-secondary/15 ring-0 transition-colors duration-200 hover:bg-secondary-hover active:bg-secondary-press focus:outline-none focus-visible:outline-none focus-visible:ring-0 disabled:bg-secondary-disabled disabled:shadow-none sm:!min-h-[44px] sm:!min-w-[44px]"
                  isProcessing={chatProcessing}
                  disabled={chatProcessing || !userMessage || realtimeAPIMode}
                  onClick={handleSendClick}
                  data-testid="chat-send-button"
                />

                <IconButton
                  iconName="stop"
                  className="!min-h-10 !min-w-10 !rounded-xl !border !border-white/35 !p-2 bg-primary shadow-md shadow-primary/15 ring-0 transition-colors duration-200 hover:bg-primary-hover focus:outline-none focus-visible:outline-none focus-visible:ring-0 sm:!min-h-[44px] sm:!min-w-[44px]"
                  onClick={onClickStopButton}
                  isProcessing={false}
                  data-testid="chat-stop-button"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
