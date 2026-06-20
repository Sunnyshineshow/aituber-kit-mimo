import { useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import externalLinkageWebSocketStore from '@/features/stores/externalLinkageWebSocketStore'
import { EmotionType } from '@/features/messages/messages'
import { useRestrictedMode } from '@/hooks/useRestrictedMode'
import {
  createExternalLinkageHelloEvent,
  createExternalLinkagePingEvent,
  ExternalLinkageMessage,
  normalizeExternalLinkageControlEvent,
  normalizeExternalLinkageIncomingMessage,
} from '@/features/externalLinkage/externalLinkageProtocol'

const HEARTBEAT_INTERVAL_MS = 15000
const HEARTBEAT_TIMEOUT_MS = 45000

///取得したコメントをストックするリストの作成（receivedMessages）
interface Params {
  handleReceiveTextFromWs: (
    text: string,
    role?: string,
    emotion?: EmotionType,
    type?: string,
    image?: string,
    requestId?: string
  ) => Promise<void>
}

const useExternalLinkage = ({ handleReceiveTextFromWs }: Params) => {
  const { t } = useTranslation()
  const { isRestrictedMode } = useRestrictedMode()
  const externalLinkageMode = settingsStore((s) => s.externalLinkageMode)
  const processingQueueRef = useRef(Promise.resolve())
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const helloSentRef = useRef(false)

  const processMessage = useCallback(
    async (message: ExternalLinkageMessage) => {
      await handleReceiveTextFromWs(
        message.text,
        message.role,
        message.emotion,
        message.type,
        message.image,
        message.requestId
      )
    },
    [handleReceiveTextFromWs]
  )

  const enqueueMessage = useCallback(
    (message: ExternalLinkageMessage) => {
      const processedMessage =
        message.role === 'output' ||
        message.role === 'executing' ||
        message.role === 'console'
          ? { ...message, role: 'code' }
          : message

      processingQueueRef.current = processingQueueRef.current.then(() =>
        processMessage(processedMessage)
      )
    },
    [processMessage]
  )

  useEffect(() => {
    const ss = settingsStore.getState()
    if (!ss.externalLinkageMode || isRestrictedMode) return

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
    }

    const scheduleReconnect = () => {
      if (reconnectTimerRef.current) return
      const state = externalLinkageWebSocketStore.getState()
      const delayMs = state.reconnectDelayMs
      externalLinkageWebSocketStore.getState().markReconnectScheduled(delayMs)
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        if (!settingsStore.getState().externalLinkageMode) return
        homeStore.setState({ chatProcessing: false })
        console.log('try reconnecting...')
        externalLinkageWebSocketStore.getState().reconnect()
      }, delayMs)
    }

    const handleOpen = (event: Event) => {
      clearReconnectTimer()
      helloSentRef.current = false
      externalLinkageWebSocketStore.getState().resetReconnectState()
    }
    const handleMessage = async (event: MessageEvent) => {
      const jsonData = JSON.parse(event.data)
      const controlEvent = normalizeExternalLinkageControlEvent(jsonData)
      if (controlEvent) {
        if (controlEvent.type === 'session.ready') {
          const store = externalLinkageWebSocketStore.getState()
          store.setProtocolVersion('2', controlEvent.capabilities)
          if (!helloSentRef.current) {
            store.send(JSON.stringify(createExternalLinkageHelloEvent()))
            helloSentRef.current = true
          }
          return
        }
        if (controlEvent.type === 'pong') {
          externalLinkageWebSocketStore.getState().markPong()
          return
        }
        if (controlEvent.type === 'ack') {
          externalLinkageWebSocketStore
            .getState()
            .markAck(controlEvent.requestId)
          return
        }
        if (
          controlEvent.type === 'chat.done' ||
          controlEvent.type === 'chat.error'
        ) {
          const store = externalLinkageWebSocketStore.getState()
          if (controlEvent.type === 'chat.error') {
            store.failRequest(controlEvent.requestId, controlEvent.message)
          } else {
            store.completeRequest(controlEvent.requestId)
          }
        }
      }
      if (jsonData?.version === '2' && jsonData?.type === 'session.ready') {
        return
      }
      const message = normalizeExternalLinkageIncomingMessage(jsonData)
      if (!message) return
      enqueueMessage(message)
    }
    const handleError = (event: Event) => {
      scheduleReconnect()
    }
    const handleClose = (event: Event) => {
      scheduleReconnect()
    }

    const handlers = {
      onOpen: handleOpen,
      onMessage: handleMessage,
      onError: handleError,
      onClose: handleClose,
    }

    function connectWebsocket() {
      const { wsManager } = externalLinkageWebSocketStore.getState()
      if (wsManager?.isConnected()) return wsManager.websocket
      return new WebSocket(settingsStore.getState().externalLinkageUrl)
    }

    externalLinkageWebSocketStore
      .getState()
      .initializeWebSocket(t, handlers, connectWebsocket)

    const heartbeatInterval = setInterval(() => {
      const state = externalLinkageWebSocketStore.getState()
      if (
        state.protocolVersion !== '2' ||
        state.wsManager?.websocket?.readyState !== WebSocket.OPEN
      ) {
        return
      }

      const lastPongAt = state.lastPongAt
        ? new Date(state.lastPongAt).getTime()
        : null
      if (lastPongAt && Date.now() - lastPongAt > HEARTBEAT_TIMEOUT_MS) {
        state.markHeartbeatStale()
      }

      state.send(JSON.stringify(createExternalLinkagePingEvent()))
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      clearReconnectTimer()
      clearInterval(heartbeatInterval)
      externalLinkageWebSocketStore.getState().disconnect()
    }
  }, [externalLinkageMode, isRestrictedMode, t, enqueueMessage])

  return null
}

export default useExternalLinkage
