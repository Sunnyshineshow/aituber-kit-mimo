import { useState, useEffect, useCallback, useRef } from 'react'
import settingsStore from '@/features/stores/settings'
import homeStore from '@/features/stores/home'
import { speakCharacter } from '@/features/messages/speakCharacter'
import { SpeakQueue } from '@/features/messages/speakQueue'
import { Talk, splitSentence } from '@/features/messages/messages'
import CaptureService from '@/features/gameCommentary/captureService'
import { analyzeGameCommentaryScene } from '@/features/gameCommentary/analyzeGameCommentaryScene'
import {
  generateGameCommentary,
  BackgroundSceneAnalysisEntry,
  CommentaryHistoryEntry,
} from '@/features/gameCommentary/generateGameCommentary'
import { GAME_COMMENTARY_BACKGROUND_ANALYSIS } from '@/features/gameCommentary/gameCommentaryTypes'

const MIN_SCHEDULED_CAPTURE_INTERVAL_SECONDS = 3

/**
 * ゲーム実況モードの状態型
 */
export type GameCommentaryState =
  | 'disabled'
  | 'waiting'
  | 'capturing'
  | 'speaking'

/**
 * useGameCommentaryModeフックのコールバック
 */
export interface UseGameCommentaryModeProps {
  onCommentaryStart?: (phrase: { text: string; emotion: string }) => void
  onCommentaryComplete?: () => void
  onCommentaryInterrupted?: () => void
}

/**
 * useGameCommentaryModeフックの戻り値
 */
export interface UseGameCommentaryModeReturn {
  isActive: boolean
  state: GameCommentaryState
  secondsUntilNextCapture: number
  isCaptureAvailable: boolean
  resetTimer: () => void
  stopCommentary: () => void
}

/**
 * ゲーム実況モードのコアロジックを提供するカスタムフック
 *
 * 画面キャプチャを一定間隔で取得し、AIがリアルタイムで実況コメントを生成・発話する。
 * 完了ベースのsetTimeoutループにより、生成時間+発話時間が長くても重ならない。
 */
export function useGameCommentaryMode({
  onCommentaryStart,
  onCommentaryComplete,
  onCommentaryInterrupted,
}: UseGameCommentaryModeProps): UseGameCommentaryModeReturn {
  // ----- 設定の取得 -----
  const ss = settingsStore.getState()
  const gameCommentaryEnabled = ss.gameCommentaryEnabled
  const gameCommentaryPlaying = ss.gameCommentaryPlaying
  const gameCommentaryCaptureInterval = ss.gameCommentaryCaptureInterval ?? 5
  const gameCommentaryContextCount = ss.gameCommentaryContextCount ?? 5
  const gameCommentaryImageQuality = ss.gameCommentaryImageQuality || 0.7
  const gameCommentaryResizeWidth = ss.gameCommentaryResizeWidth || 1024
  const gameCommentaryBackgroundAnalysisEnabled =
    ss.gameCommentaryBackgroundAnalysisEnabled === true
  const gameCommentaryBackgroundAnalysisInterval =
    ss.gameCommentaryBackgroundAnalysisInterval ?? 2

  // settingsStoreの変更を監視して再レンダリングをトリガー
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      forceUpdate((n) => n + 1)
    })
    return unsubscribe
  }, [])

  // ----- 状態 -----
  const isRunning = gameCommentaryEnabled && gameCommentaryPlaying
  const [state, setState] = useState<GameCommentaryState>(
    isRunning ? 'waiting' : 'disabled'
  )
  const [secondsUntilNextCapture, setSecondsUntilNextCapture] =
    useState<number>(gameCommentaryCaptureInterval)
  const [isCaptureAvailable, setIsCaptureAvailable] = useState<boolean>(false)

  // ----- Refs -----
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const backgroundAnalysisTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const commentaryHistoryRef = useRef<CommentaryHistoryEntry[]>([])
  const backgroundSceneAnalysesRef = useRef<BackgroundSceneAnalysisEntry[]>([])
  const isProcessingRef = useRef(false)
  const isBackgroundAnalysisInFlightRef = useRef(false)
  const isRunningRef = useRef(isRunning)
  isRunningRef.current = isRunning
  const stateRef = useRef<GameCommentaryState>(state)
  stateRef.current = state
  const commentaryRequestTokenRef = useRef(0)
  const commentaryAbortControllerRef = useRef<AbortController | null>(null)
  const captureIntervalRef = useRef(gameCommentaryCaptureInterval)
  captureIntervalRef.current = gameCommentaryCaptureInterval
  const backgroundAnalysisGenerationRef = useRef(0)
  const queueNextBackgroundAnalysisRef = useRef<() => void>(() => {})

  const getEffectiveCaptureInterval = useCallback(() => {
    return Math.max(
      captureIntervalRef.current,
      MIN_SCHEDULED_CAPTURE_INTERVAL_SECONDS
    )
  }, [])

  // Callback refs to avoid stale closures
  const callbackRefs = useRef({
    onCommentaryStart,
    onCommentaryComplete,
    onCommentaryInterrupted,
  })

  useEffect(() => {
    callbackRefs.current = {
      onCommentaryStart,
      onCommentaryComplete,
      onCommentaryInterrupted,
    }
  })

  // ----- CaptureService可用性チェック -----
  useEffect(() => {
    const checkInterval = setInterval(() => {
      setIsCaptureAvailable(CaptureService.getInstance().isAvailable())
    }, 1000)
    return () => clearInterval(checkInterval)
  }, [])

  // ----- 発話条件判定 -----
  const canSpeak = useCallback((): boolean => {
    const hs = homeStore.getState()
    if (hs.chatProcessing) return false
    if (hs.chatProcessingCount > 0) return false
    if (hs.isSpeaking) return false
    if (!hs.captureStatus) return false
    return true
  }, [])

  const abortActiveCommentaryRequest = useCallback(() => {
    commentaryAbortControllerRef.current?.abort()
    commentaryAbortControllerRef.current = null
  }, [])

  const invalidateActiveCommentary = useCallback(() => {
    commentaryRequestTokenRef.current += 1
    abortActiveCommentaryRequest()
    isProcessingRef.current = false
  }, [abortActiveCommentaryRequest])

  // ----- ring bufferに追加 -----
  const addToHistory = useCallback(
    (entry: CommentaryHistoryEntry) => {
      if (gameCommentaryContextCount <= 0) return
      commentaryHistoryRef.current.push(entry)
      if (commentaryHistoryRef.current.length > gameCommentaryContextCount) {
        commentaryHistoryRef.current = commentaryHistoryRef.current.slice(
          -gameCommentaryContextCount
        )
      }
    },
    [gameCommentaryContextCount]
  )

  // ----- タイマークリア -----
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }, [])

  const clearBackgroundAnalysisTimer = useCallback(() => {
    if (backgroundAnalysisTimerRef.current) {
      clearTimeout(backgroundAnalysisTimerRef.current)
      backgroundAnalysisTimerRef.current = null
    }
  }, [])

  const resetBackgroundSceneAnalyses = useCallback(() => {
    backgroundAnalysisGenerationRef.current += 1
    backgroundSceneAnalysesRef.current = []
  }, [])

  const pushBackgroundSceneAnalysis = useCallback((summary: string) => {
    if (!summary) return

    const existing =
      backgroundSceneAnalysesRef.current[
        backgroundSceneAnalysesRef.current.length - 1
      ]
    if (existing?.summary === summary) return

    backgroundSceneAnalysesRef.current.push({ summary })
    if (
      backgroundSceneAnalysesRef.current.length >
      GAME_COMMENTARY_BACKGROUND_ANALYSIS.MAX_BUFFERED_ITEMS
    ) {
      backgroundSceneAnalysesRef.current =
        backgroundSceneAnalysesRef.current.slice(
          -GAME_COMMENTARY_BACKGROUND_ANALYSIS.MAX_BUFFERED_ITEMS
        )
    }
  }, [])

  const runBackgroundSceneAnalysis = useCallback(async () => {
    if (!isRunningRef.current) return
    if (!gameCommentaryBackgroundAnalysisEnabled) return
    if (stateRef.current !== 'speaking') return
    if (isBackgroundAnalysisInFlightRef.current) return

    const captureService = CaptureService.getInstance()
    if (!captureService.isAvailable()) return

    const maxWidth =
      gameCommentaryResizeWidth > 0
        ? Math.min(
            gameCommentaryResizeWidth,
            GAME_COMMENTARY_BACKGROUND_ANALYSIS.RESIZE_WIDTH
          )
        : GAME_COMMENTARY_BACKGROUND_ANALYSIS.RESIZE_WIDTH
    const quality = Math.min(
      gameCommentaryImageQuality,
      GAME_COMMENTARY_BACKGROUND_ANALYSIS.IMAGE_QUALITY
    )
    const imageData = captureService.captureFrame(maxWidth, quality)

    if (!imageData) return

    isBackgroundAnalysisInFlightRef.current = true
    const generationAtStart = backgroundAnalysisGenerationRef.current

    try {
      const summary = await analyzeGameCommentaryScene(imageData)
      if (!summary) return
      if (generationAtStart !== backgroundAnalysisGenerationRef.current) return
      if (!isRunningRef.current || stateRef.current !== 'speaking') return
      pushBackgroundSceneAnalysis(summary)
    } finally {
      isBackgroundAnalysisInFlightRef.current = false
      if (isRunningRef.current && stateRef.current === 'speaking') {
        queueNextBackgroundAnalysisRef.current()
      }
    }
  }, [
    gameCommentaryBackgroundAnalysisEnabled,
    gameCommentaryImageQuality,
    gameCommentaryResizeWidth,
    pushBackgroundSceneAnalysis,
  ])

  useEffect(() => {
    queueNextBackgroundAnalysisRef.current = () => {
      clearBackgroundAnalysisTimer()
      if (
        !isRunningRef.current ||
        !gameCommentaryBackgroundAnalysisEnabled ||
        stateRef.current !== 'speaking'
      ) {
        return
      }

      backgroundAnalysisTimerRef.current = setTimeout(() => {
        void runBackgroundSceneAnalysis()
      }, gameCommentaryBackgroundAnalysisInterval * 1000)
    }
  }, [
    clearBackgroundAnalysisTimer,
    gameCommentaryBackgroundAnalysisEnabled,
    gameCommentaryBackgroundAnalysisInterval,
    runBackgroundSceneAnalysis,
  ])

  // ----- 次回キャプチャのスケジュール -----
  const scheduleNext = useCallback(() => {
    clearTimers()
    const interval = getEffectiveCaptureInterval()
    setSecondsUntilNextCapture(interval)

    if (interval > 0) {
      countdownRef.current = setInterval(() => {
        setSecondsUntilNextCapture((prev) => Math.max(prev - 1, 0))
      }, 1000)
    }

    timerRef.current = setTimeout(() => {
      triggerCommentary()
    }, interval * 1000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, getEffectiveCaptureInterval])

  // ----- 実況トリガー -----
  const triggerCommentary = useCallback(async () => {
    if (isProcessingRef.current) return
    if (!canSpeak()) {
      scheduleNext()
      return
    }

    const captureService = CaptureService.getInstance()
    if (!captureService.isAvailable()) {
      scheduleNext()
      return
    }

    isProcessingRef.current = true
    setState('capturing')
    const requestToken = commentaryRequestTokenRef.current + 1
    commentaryRequestTokenRef.current = requestToken

    // キャプチャ取得
    const imageData = captureService.captureFrame(
      gameCommentaryResizeWidth,
      gameCommentaryImageQuality
    )

    if (!imageData) {
      console.warn('ゲーム実況: キャプチャ取得失敗')
      isProcessingRef.current = false
      setState('waiting')
      scheduleNext()
      return
    }

    // AI実況コメント生成
    const abortController = new AbortController()
    commentaryAbortControllerRef.current = abortController

    try {
      const backgroundSceneAnalyses = backgroundSceneAnalysesRef.current
      resetBackgroundSceneAnalyses()

      // chatLogから直近メッセージを取得（視聴者コメントとの文脈共有）
      const maxPastMessages = settingsStore.getState().maxPastMessages
      const chatLog = homeStore.getState().chatLog
      const recentMessages = chatLog
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .slice(maxPastMessages > 0 ? -maxPastMessages : 0)
        .map((m) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content : '',
        }))

      const result = await generateGameCommentary(
        commentaryHistoryRef.current,
        imageData,
        recentMessages,
        backgroundSceneAnalyses,
        { signal: abortController.signal }
      )

      if (!result) {
        if (requestToken !== commentaryRequestTokenRef.current) {
          return
        }
        isProcessingRef.current = false
        setState('waiting')
        scheduleNext()
        return
      }

      if (requestToken !== commentaryRequestTokenRef.current) {
        return
      }

      if (!canSpeak()) {
        isProcessingRef.current = false
        setState('waiting')
        scheduleNext()
        return
      }

      // ring bufferに追加（実況テキスト + 情景描写）
      addToHistory({
        commentary: result.text,
        sceneDescription: result.sceneDescription,
      })

      // chatLogに保存（YouTube/Mastraとの文脈共有用）
      const currentSaveToChat =
        settingsStore.getState().gameCommentarySaveToChat === true
      if (currentSaveToChat) {
        homeStore.getState().upsertMessage({
          role: 'assistant',
          content: `[実況] ${result.text}`,
          timestamp: new Date().toISOString(),
        })
      }

      // 状態をspeakingに変更
      setState('speaking')
      callbackRefs.current.onCommentaryStart?.(result)

      // テキストを文節分割して順番に発話
      const sentences = splitSentence(result.text)
      if (sentences.length === 0) {
        isProcessingRef.current = false
        setState('waiting')
        scheduleNext()
        return
      }

      // セッションIDを更新
      sessionIdRef.current = `game-commentary-${Date.now()}`

      // 分割した文を順番に発話キューに投入
      const lastIndex = sentences.length - 1
      for (let i = 0; i < sentences.length; i++) {
        const talk: Talk = {
          message: sentences[i],
          emotion: result.emotion,
        }

        speakCharacter(
          sessionIdRef.current,
          talk,
          () => {
            // onStart
          },
          i === lastIndex
            ? () => {
                // 最後の文の完了時に次回スケジュール
                isProcessingRef.current = false
                callbackRefs.current.onCommentaryComplete?.()
                if (isRunningRef.current) {
                  setState('waiting')
                  scheduleNext()
                }
              }
            : undefined
        )
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return
      }

      console.error('ゲーム実況コメント生成エラー:', error)
      isProcessingRef.current = false
      if (isRunningRef.current) {
        setState('waiting')
        scheduleNext()
      }
    } finally {
      if (commentaryAbortControllerRef.current === abortController) {
        commentaryAbortControllerRef.current = null
      }
    }
  }, [
    canSpeak,
    gameCommentaryResizeWidth,
    gameCommentaryImageQuality,
    addToHistory,
    resetBackgroundSceneAnalyses,
    scheduleNext,
  ])

  // ----- タイマーリセット -----
  const resetTimer = useCallback(() => {
    clearTimers()
    setSecondsUntilNextCapture(getEffectiveCaptureInterval())
    if (isRunning && state !== 'disabled') {
      scheduleNext()
    }
  }, [
    isRunning,
    state,
    clearTimers,
    getEffectiveCaptureInterval,
    scheduleNext,
  ])

  // ----- 実況停止 -----
  const stopCommentary = useCallback(() => {
    clearTimers()
    clearBackgroundAnalysisTimer()
    resetBackgroundSceneAnalyses()
    invalidateActiveCommentary()
    SpeakQueue.stopSession(sessionIdRef.current)
    sessionIdRef.current = null
    setState('waiting')
    setSecondsUntilNextCapture(getEffectiveCaptureInterval())
    callbackRefs.current.onCommentaryInterrupted?.()
  }, [
    clearBackgroundAnalysisTimer,
    clearTimers,
    getEffectiveCaptureInterval,
    invalidateActiveCommentary,
    resetBackgroundSceneAnalyses,
  ])

  // ----- 有効/無効の監視 -----
  useEffect(() => {
    if (isRunning) {
      setState('waiting')
      setSecondsUntilNextCapture(getEffectiveCaptureInterval())
      scheduleNext()
    } else {
      setState('disabled')
      clearTimers()
      clearBackgroundAnalysisTimer()
      SpeakQueue.stopSession(sessionIdRef.current)
      sessionIdRef.current = null
      commentaryHistoryRef.current = []
      resetBackgroundSceneAnalyses()
      invalidateActiveCommentary()
    }

    return () => {
      clearTimers()
      clearBackgroundAnalysisTimer()
    }
  }, [
    isRunning,
    clearBackgroundAnalysisTimer,
    clearTimers,
    getEffectiveCaptureInterval,
    invalidateActiveCommentary,
    resetBackgroundSceneAnalyses,
    scheduleNext,
  ])

  // ----- 発話中のバックグラウンド解析 -----
  useEffect(() => {
    if (
      !isRunning ||
      !gameCommentaryBackgroundAnalysisEnabled ||
      state !== 'speaking'
    ) {
      clearBackgroundAnalysisTimer()
      return
    }

    queueNextBackgroundAnalysisRef.current()

    return () => {
      clearBackgroundAnalysisTimer()
    }
  }, [
    isRunning,
    state,
    clearBackgroundAnalysisTimer,
    gameCommentaryBackgroundAnalysisEnabled,
  ])

  // ----- chatLog変更の監視（ユーザー入力検知） -----
  useEffect(() => {
    if (!isRunning) return

    const unsubscribe = homeStore.subscribe((hState, prevState) => {
      const interactionStarted =
        (!prevState.chatProcessing && hState.chatProcessing) ||
        (!prevState.isSpeaking && hState.isSpeaking)

      if (interactionStarted && stateRef.current === 'capturing') {
        stopCommentary()
        resetTimer()
        return
      }

      if (hState.chatLog !== prevState.chatLog && hState.chatLog.length > 0) {
        // ユーザー入力があったらタイマーリセット
        const latestMsg = hState.chatLog[hState.chatLog.length - 1]
        if (latestMsg?.role === 'user') {
          // 発話中/生成中の場合は停止
          if (
            stateRef.current === 'speaking' ||
            stateRef.current === 'capturing'
          ) {
            stopCommentary()
          }

          resetTimer()
        }
      }
    })

    return unsubscribe
  }, [isRunning, resetTimer, stopCommentary])

  return {
    isActive: isRunning && state !== 'disabled',
    state,
    secondsUntilNextCapture,
    isCaptureAvailable,
    resetTimer,
    stopCommentary,
  }
}
