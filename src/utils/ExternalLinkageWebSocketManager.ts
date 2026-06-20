import toastStore from '@/features/stores/toast'

export type ExternalLinkageWebSocketStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'closed'
  | 'error'

type TranslationFunction = (key: string, options?: any) => string

export interface ExternalLinkageWebSocketHandlers {
  onOpen: (event: Event) => void
  onMessage: (event: MessageEvent) => Promise<void>
  onError: (event: Event) => void
  onClose: (event: Event) => void
}

interface ExternalLinkageWebSocketManagerOptions {
  onStatusChange?: (
    status: ExternalLinkageWebSocketStatus,
    details?: { lastError?: string | null; connectedAt?: string | null }
  ) => void
}

export class ExternalLinkageWebSocketManager {
  private ws: WebSocket | null = null
  private t: TranslationFunction
  private isTextBlockStarted = false
  private handlers: ExternalLinkageWebSocketHandlers
  private connectWebsocket: () => WebSocket | null
  private onStatusChange?: ExternalLinkageWebSocketManagerOptions['onStatusChange']

  constructor(
    t: TranslationFunction,
    handlers: ExternalLinkageWebSocketHandlers,
    connectWebsocket: () => WebSocket | null,
    options: ExternalLinkageWebSocketManagerOptions = {}
  ) {
    this.t = t
    this.handlers = handlers
    this.connectWebsocket = connectWebsocket
    this.onStatusChange = options.onStatusChange
  }

  private updateStatus(
    status: ExternalLinkageWebSocketStatus,
    details?: { lastError?: string | null; connectedAt?: string | null }
  ) {
    this.onStatusChange?.(status, details)
  }

  private handleOpen = (event: Event) => {
    console.log('External linkage WebSocket connection opened:', event)
    this.removeToast()
    this.updateStatus('open', {
      connectedAt: new Date().toISOString(),
      lastError: null,
    })
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionSuccess'),
      type: 'success',
      duration: 3000,
      tag: 'external-linkage-websocket-connection-success',
    })
    this.handlers.onOpen(event)
  }

  private handleMessage = async (event: MessageEvent) => {
    console.log('External linkage WebSocket received message:', event)
    await this.handlers.onMessage(event)
  }

  private handleError = (event: Event) => {
    console.error('External linkage WebSocket error:', event)
    this.removeToast()
    this.updateStatus('error', {
      lastError: this.t('Toasts.WebSocketConnectionError'),
    })
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionError'),
      type: 'error',
      duration: 5000,
      tag: 'external-linkage-websocket-connection-error',
    })
    this.handlers.onError(event)
  }

  private handleClose = (event: Event) => {
    console.log('External linkage WebSocket connection closed:', event)
    this.removeToast()
    this.updateStatus('closed', { connectedAt: null })
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionClosed'),
      type: 'error',
      duration: 3000,
      tag: 'external-linkage-websocket-connection-close',
    })
    this.handlers.onClose(event)
  }

  public connect() {
    this.removeToast()
    this.updateStatus('connecting')
    toastStore.getState().addToast({
      message: this.t('Toasts.WebSocketConnectionAttempt'),
      type: 'info',
      duration: 10000,
      tag: 'external-linkage-websocket-connection-info',
    })

    this.ws = this.connectWebsocket()

    if (!this.ws) {
      this.updateStatus('closed', {
        lastError: this.t('Toasts.WebSocketConnectionError'),
      })
      return
    }

    this.ws.addEventListener('open', this.handleOpen)
    this.ws.addEventListener('message', this.handleMessage)
    this.ws.addEventListener('error', this.handleError)
    this.ws.addEventListener('close', this.handleClose)
  }

  public removeToast() {
    toastStore
      .getState()
      .removeToast('external-linkage-websocket-connection-error')
    toastStore
      .getState()
      .removeToast('external-linkage-websocket-connection-success')
    toastStore
      .getState()
      .removeToast('external-linkage-websocket-connection-close')
    toastStore
      .getState()
      .removeToast('external-linkage-websocket-connection-info')
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close()
    }
  }

  public reconnect(): boolean {
    this.disconnect()
    this.connect()
    return true
  }

  public send(data: string): boolean {
    if (!this.isConnected()) return false
    this.ws?.send(data)
    return true
  }

  public get websocket(): WebSocket | null {
    return this.ws
  }

  public get textBlockStarted(): boolean {
    return this.isTextBlockStarted
  }

  setTextBlockStarted(value: boolean) {
    this.isTextBlockStarted = value
  }

  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN
  }
}
