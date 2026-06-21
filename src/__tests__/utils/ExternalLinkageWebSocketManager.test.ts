/**
 * @jest-environment node
 */

const mockAddToast = jest.fn()
const mockRemoveToast = jest.fn()

jest.mock('@/features/stores/toast', () => ({
  getState: () => ({
    addToast: (...args: unknown[]) => mockAddToast(...args),
    removeToast: (...args: unknown[]) => mockRemoveToast(...args),
  }),
}))

import { ExternalLinkageWebSocketManager } from '@/utils/ExternalLinkageWebSocketManager'

class MockWebSocket {
  static OPEN = 1
  static CLOSED = 3
  readyState = MockWebSocket.OPEN
  listeners: Record<string, Function[]> = {}
  send = jest.fn()

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = []
    this.listeners[event].push(fn)
  }

  removeEventListener(event: string, fn: Function) {
    this.listeners[event] = (this.listeners[event] || []).filter(
      (listener) => listener !== fn
    )
  }

  close() {
    this.readyState = MockWebSocket.CLOSED
  }

  trigger(event: string, data?: unknown) {
    ;(this.listeners[event] || []).forEach((fn) => fn(data))
  }
}

;(global as any).WebSocket = MockWebSocket

describe('ExternalLinkageWebSocketManager', () => {
  const mockT = jest.fn((key: string) => key)
  let mockWs: MockWebSocket
  let mockConnectWebsocket: jest.Mock
  let mockStatusChange: jest.Mock
  let handlers: {
    onOpen: jest.Mock
    onMessage: jest.Mock
    onError: jest.Mock
    onClose: jest.Mock
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockWs = new MockWebSocket()
    mockConnectWebsocket = jest.fn(() => mockWs as unknown as WebSocket)
    mockStatusChange = jest.fn()
    handlers = {
      onOpen: jest.fn(),
      onMessage: jest.fn().mockResolvedValue(undefined),
      onError: jest.fn(),
      onClose: jest.fn(),
    }
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('connects and registers event listeners', () => {
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket,
      { onStatusChange: mockStatusChange }
    )
    manager.connect()

    expect(mockStatusChange).toHaveBeenCalledWith('connecting', undefined)
    expect(mockConnectWebsocket).toHaveBeenCalledTimes(1)
    expect(mockWs.listeners.open).toHaveLength(1)
    expect(mockWs.listeners.message).toHaveLength(1)
    expect(mockWs.listeners.error).toHaveLength(1)
    expect(mockWs.listeners.close).toHaveLength(1)
  })

  it('handles connectWebsocket exceptions as connection errors', () => {
    mockConnectWebsocket.mockImplementationOnce(() => {
      throw new Error('invalid url')
    })
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket,
      { onStatusChange: mockStatusChange }
    )

    manager.connect()

    expect(mockStatusChange).toHaveBeenCalledWith('closed', {
      connectedAt: null,
      lastError: 'Toasts.WebSocketConnectionError',
    })
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'external-linkage-websocket-connection-error',
        type: 'error',
      })
    )
  })

  it('catches async message handler failures', async () => {
    handlers.onMessage.mockRejectedValueOnce(new Error('bad payload'))
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket,
      { onStatusChange: mockStatusChange }
    )
    manager.connect()

    mockWs.trigger('message', { data: 'bad' } as MessageEvent)
    await Promise.resolve()

    expect(mockStatusChange).toHaveBeenCalledWith('error', {
      lastError: 'Toasts.WebSocketConnectionError',
    })
    expect(handlers.onError).toHaveBeenCalled()
  })

  it('detaches old socket listeners when disconnecting', () => {
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket,
      { onStatusChange: mockStatusChange }
    )
    manager.connect()
    manager.disconnect()

    expect(mockWs.listeners.open).toHaveLength(0)
    expect(mockWs.listeners.message).toHaveLength(0)
    expect(mockWs.listeners.error).toHaveLength(0)
    expect(mockWs.listeners.close).toHaveLength(0)
  })

  it('updates status and shows toast on open', () => {
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket,
      { onStatusChange: mockStatusChange }
    )
    manager.connect()

    mockWs.trigger('open', new Event('open'))

    expect(mockStatusChange).toHaveBeenCalledWith(
      'open',
      expect.objectContaining({ lastError: null })
    )
    expect(mockAddToast).toHaveBeenCalledWith(
      expect.objectContaining({
        tag: 'external-linkage-websocket-connection-success',
        type: 'success',
      })
    )
    expect(handlers.onOpen).toHaveBeenCalled()
  })

  it('sends only when connected', () => {
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket
    )
    manager.connect()

    expect(manager.send('hello')).toBe(true)
    expect(mockWs.send).toHaveBeenCalledWith('hello')

    mockWs.close()

    expect(manager.send('closed')).toBe(false)
  })

  it('tracks text block state for streaming legacy messages', () => {
    const manager = new ExternalLinkageWebSocketManager(
      mockT,
      handlers,
      mockConnectWebsocket
    )

    expect(manager.textBlockStarted).toBe(false)
    manager.setTextBlockStarted(true)
    expect(manager.textBlockStarted).toBe(true)
  })
})
