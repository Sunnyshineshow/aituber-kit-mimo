import { EmotionType } from '@/features/messages/messages'

export interface ExternalLinkageMessage {
  text: string
  role: string
  emotion: EmotionType
  type: string
  image?: string
  requestId?: string
  sourceEventType?: string
}

export interface LegacyExternalLinkageChatPayload {
  content: string
  type: 'chat'
  image?: string
}

export interface ExternalLinkageEnvelope {
  version: '2'
  id: string
  type: string
  sessionId: string
  timestamp: string
  payload: Record<string, unknown>
  metadata?: Record<string, unknown>
  requestId?: string
}

export interface ExternalLinkageControlEvent {
  type:
    | 'session.ready'
    | 'ack'
    | 'pong'
    | 'chat.done'
    | 'chat.error'
    | 'unknown'
  id?: string
  requestId?: string
  protocolVersion?: '2'
  capabilities?: string[]
  timestamp?: string
  message?: string
}

const createMessageId = () =>
  `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

const createSessionId = () =>
  `session_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`

let externalLinkageSessionId = createSessionId()

export const resetExternalLinkageSessionId = () => {
  externalLinkageSessionId = createSessionId()
  return externalLinkageSessionId
}

export const createExternalLinkageEvent = (
  type: string,
  payload: Record<string, unknown> = {},
  options: {
    requestId?: string
    metadata?: Record<string, unknown>
  } = {}
): ExternalLinkageEnvelope => ({
  version: '2',
  id: createMessageId(),
  type,
  sessionId: externalLinkageSessionId,
  timestamp: new Date().toISOString(),
  payload,
  ...(options.metadata ? { metadata: options.metadata } : {}),
  ...(options.requestId ? { requestId: options.requestId } : {}),
})

export const createLegacyExternalLinkageChatPayload = (
  content: string,
  image?: string
): LegacyExternalLinkageChatPayload => ({
  content,
  type: 'chat',
  ...(image ? { image } : {}),
})

export const createV2ExternalLinkageChatEvent = (
  content: string,
  image?: string
): ExternalLinkageEnvelope =>
  createExternalLinkageEvent('chat.message', {
    text: content,
    ...(image ? { image } : {}),
  })

export const createExternalLinkageHelloEvent = (): ExternalLinkageEnvelope =>
  createExternalLinkageEvent('session.hello', {
    protocolVersion: '2',
    capabilities: [
      'ack',
      'ping',
      'pong',
      'chat.message',
      'chat.start',
      'chat.delta',
      'chat.done',
      'chat.error',
      'file.upload',
      'control.cancel',
      'character.message.received',
      'character.message.rendered',
      'character.speech.start',
      'character.speech.done',
      'character.speech.error',
      'character.response.done',
    ],
  })

export const createExternalLinkagePingEvent = (): ExternalLinkageEnvelope =>
  createExternalLinkageEvent('ping')

export const createExternalLinkageCancelEvent = (
  requestId?: string | null
): ExternalLinkageEnvelope =>
  createExternalLinkageEvent(
    'control.cancel',
    {},
    requestId ? { requestId } : {}
  )

export const createExternalLinkageLifecycleEvent = (
  type: string,
  requestId?: string | null,
  payload: Record<string, unknown> = {}
): ExternalLinkageEnvelope =>
  createExternalLinkageEvent(
    type,
    {
      ...(requestId ? { requestId } : {}),
      ...payload,
    },
    requestId ? { requestId } : {}
  )

export const normalizeExternalLinkageControlEvent = (
  data: any
): ExternalLinkageControlEvent | null => {
  if (data?.version !== '2') return null

  switch (data.type) {
    case 'session.ready':
      return {
        type: 'session.ready',
        id: data.id,
        requestId: data.requestId,
        protocolVersion: '2',
        capabilities: data.payload?.capabilities ?? [],
        timestamp: data.timestamp,
      }
    case 'ack':
      return {
        type: 'ack',
        id: data.id,
        requestId: data.requestId ?? data.payload?.requestId,
        timestamp: data.timestamp,
      }
    case 'pong':
      return {
        type: 'pong',
        id: data.id,
        requestId: data.requestId,
        timestamp: data.timestamp,
      }
    case 'chat.done':
      return {
        type: 'chat.done',
        id: data.id,
        requestId: data.requestId ?? data.payload?.requestId,
        timestamp: data.timestamp,
      }
    case 'chat.error':
      return {
        type: 'chat.error',
        id: data.id,
        requestId: data.requestId ?? data.payload?.requestId,
        message: data.payload?.message ?? data.payload?.text ?? '',
        timestamp: data.timestamp,
      }
    default:
      return null
  }
}

export const normalizeExternalLinkageIncomingMessage = (
  data: any
): ExternalLinkageMessage | null => {
  if (data?.version !== '2') {
    if (!data || typeof data !== 'object') return null
    return {
      text: data.text ?? '',
      role: data.role,
      emotion: data.emotion ?? 'neutral',
      type: data.type ?? '',
      ...(data.image ? { image: data.image } : {}),
    }
  }

  const payload = data.payload ?? {}
  switch (data.type) {
    case 'chat.start':
      return {
        text: payload.text ?? '',
        role: payload.role ?? 'assistant',
        emotion: payload.emotion ?? 'neutral',
        type: 'start',
        requestId: data.requestId ?? payload.requestId,
        sourceEventType: data.type,
        ...(payload.image ? { image: payload.image } : {}),
      }
    case 'chat.delta':
      return {
        text: payload.text ?? '',
        role: payload.role ?? 'assistant',
        emotion: payload.emotion ?? 'neutral',
        type: payload.legacyType ?? '',
        requestId: data.requestId ?? payload.requestId,
        sourceEventType: data.type,
        ...(payload.image ? { image: payload.image } : {}),
      }
    case 'chat.done':
      return {
        text: payload.text ?? '',
        role: payload.role ?? 'assistant',
        emotion: payload.emotion ?? 'neutral',
        type: 'end',
        requestId: data.requestId ?? payload.requestId,
        sourceEventType: data.type,
        ...(payload.image ? { image: payload.image } : {}),
      }
    case 'chat.error':
      return {
        text: payload.message ?? payload.text ?? '',
        role: payload.role ?? 'assistant',
        emotion: payload.emotion ?? 'neutral',
        type: 'end',
        requestId: data.requestId ?? payload.requestId,
        sourceEventType: data.type,
      }
    default:
      return null
  }
}
