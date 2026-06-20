import { create } from 'zustand'
import {
  ExternalLinkageWebSocketHandlers,
  ExternalLinkageWebSocketManager,
  ExternalLinkageWebSocketStatus,
} from '@/utils/ExternalLinkageWebSocketManager'

interface ExternalLinkageWebSocketState {
  wsManager: ExternalLinkageWebSocketManager | null
  status: ExternalLinkageWebSocketStatus
  protocolVersion: 'legacy' | '2'
  capabilities: string[]
  connectedAt: string | null
  lastError: string | null
  heartbeatStatus: 'idle' | 'healthy' | 'stale'
  lastPongAt: string | null
  lastAckAt: string | null
  activeRequestId: string | null
  lastRequestId: string | null
  requestStatus: 'idle' | 'sent' | 'acknowledged' | 'completed' | 'error'
  requestError: string | null
  reconnectCount: number
  reconnectDelayMs: number
  nextReconnectAt: string | null
  initializeWebSocket: (
    t: (key: string, options?: any) => string,
    handlers: Partial<ExternalLinkageWebSocketHandlers>,
    connectWebsocket: () => WebSocket | null
  ) => void
  disconnect: () => void
  reconnect: () => boolean
  send: (data: string) => boolean
  setProtocolVersion: (
    protocolVersion: 'legacy' | '2',
    capabilities?: string[]
  ) => void
  markPong: () => void
  markHeartbeatStale: () => void
  markAck: (requestId?: string | null) => void
  startRequest: (requestId: string) => void
  completeRequest: (requestId?: string | null) => void
  failRequest: (requestId?: string | null, message?: string | null) => void
  setActiveRequestId: (requestId: string | null) => void
  markReconnectScheduled: (delayMs: number) => void
  resetReconnectState: () => void
}

const externalLinkageWebSocketStore = create<ExternalLinkageWebSocketState>(
  (set, get) => ({
    wsManager: null,
    status: 'idle',
    protocolVersion: 'legacy',
    capabilities: [],
    connectedAt: null,
    lastError: null,
    heartbeatStatus: 'idle',
    lastPongAt: null,
    lastAckAt: null,
    activeRequestId: null,
    lastRequestId: null,
    requestStatus: 'idle',
    requestError: null,
    reconnectCount: 0,
    reconnectDelayMs: 1000,
    nextReconnectAt: null,
    initializeWebSocket: (t, handlers = {}, connectWebsocket) => {
      const defaultHandlers: ExternalLinkageWebSocketHandlers = {
        onOpen: () => {},
        onMessage: async () => {},
        onError: () => {},
        onClose: () => {},
        ...handlers,
      }
      const manager = new ExternalLinkageWebSocketManager(
        t,
        defaultHandlers,
        connectWebsocket,
        {
          onStatusChange: (status, details = {}) => {
            set({
              status,
              connectedAt:
                details.connectedAt === undefined
                  ? get().connectedAt
                  : details.connectedAt,
              lastError:
                details.lastError === undefined
                  ? get().lastError
                  : details.lastError,
            })
          },
        }
      )
      manager.connect()
      set({ wsManager: manager })
    },
    disconnect: () => {
      const { wsManager } = get()
      wsManager?.disconnect()
      set({
        wsManager: null,
        status: 'idle',
        protocolVersion: 'legacy',
        capabilities: [],
        connectedAt: null,
        heartbeatStatus: 'idle',
        lastPongAt: null,
        activeRequestId: null,
        requestStatus: 'idle',
        requestError: null,
        nextReconnectAt: null,
      })
    },
    reconnect: () => {
      const { wsManager } = get()
      if (!wsManager) return false
      set((state) => ({ reconnectCount: state.reconnectCount + 1 }))
      return wsManager.reconnect()
    },
    send: (data) => {
      const { wsManager } = get()
      return wsManager?.send(data) ?? false
    },
    setProtocolVersion: (protocolVersion, capabilities = []) =>
      set({ protocolVersion, capabilities }),
    markPong: () =>
      set({
        heartbeatStatus: 'healthy',
        lastPongAt: new Date().toISOString(),
      }),
    markHeartbeatStale: () => set({ heartbeatStatus: 'stale' }),
    markAck: (requestId) =>
      set((state) => ({
        lastAckAt: new Date().toISOString(),
        requestStatus:
          requestId && state.activeRequestId === requestId
            ? 'acknowledged'
            : state.requestStatus,
        activeRequestId:
          requestId && state.activeRequestId === requestId
            ? state.activeRequestId
            : state.activeRequestId,
      })),
    startRequest: (requestId) =>
      set({
        activeRequestId: requestId,
        lastRequestId: requestId,
        requestStatus: 'sent',
        requestError: null,
      }),
    completeRequest: (requestId) =>
      set((state) => ({
        activeRequestId:
          !requestId || state.activeRequestId === requestId
            ? null
            : state.activeRequestId,
        lastRequestId: requestId ?? state.lastRequestId,
        requestStatus:
          !requestId || state.activeRequestId === requestId
            ? 'completed'
            : state.requestStatus,
      })),
    failRequest: (requestId, message) =>
      set((state) => ({
        activeRequestId:
          !requestId || state.activeRequestId === requestId
            ? null
            : state.activeRequestId,
        lastRequestId: requestId ?? state.lastRequestId,
        requestStatus:
          !requestId || state.activeRequestId === requestId
            ? 'error'
            : state.requestStatus,
        requestError: message ?? null,
      })),
    setActiveRequestId: (requestId) => set({ activeRequestId: requestId }),
    markReconnectScheduled: (delayMs) =>
      set((state) => ({
        reconnectDelayMs: Math.min(delayMs * 2, 30000),
        nextReconnectAt: new Date(Date.now() + delayMs).toISOString(),
        reconnectCount: state.reconnectCount + 1,
      })),
    resetReconnectState: () =>
      set({
        reconnectDelayMs: 1000,
        nextReconnectAt: null,
      }),
  })
)

export default externalLinkageWebSocketStore
