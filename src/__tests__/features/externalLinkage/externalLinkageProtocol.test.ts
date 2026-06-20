/**
 * @jest-environment node
 */

import {
  createExternalLinkageCancelEvent,
  createExternalLinkageHelloEvent,
  createExternalLinkageLifecycleEvent,
  createExternalLinkagePingEvent,
  createLegacyExternalLinkageChatPayload,
  createV2ExternalLinkageChatEvent,
  normalizeExternalLinkageControlEvent,
  normalizeExternalLinkageIncomingMessage,
} from '@/features/externalLinkage/externalLinkageProtocol'

describe('externalLinkageProtocol', () => {
  it('creates legacy chat payloads for current servers', () => {
    expect(createLegacyExternalLinkageChatPayload('hello')).toEqual({
      content: 'hello',
      type: 'chat',
    })
  })

  it('keeps optional image in legacy chat payloads', () => {
    expect(
      createLegacyExternalLinkageChatPayload(
        'hello',
        'data:image/png;base64,abc'
      )
    ).toEqual({
      content: 'hello',
      type: 'chat',
      image: 'data:image/png;base64,abc',
    })
  })

  it('creates v2 chat message events', () => {
    const event = createV2ExternalLinkageChatEvent('hello')

    expect(event.version).toBe('2')
    expect(event.type).toBe('chat.message')
    expect(event.payload.text).toBe('hello')
    expect(event.id).toMatch(/^msg_/)
    expect(event.sessionId).toMatch(/^session_/)
  })

  it('creates v2 ping events', () => {
    const event = createExternalLinkagePingEvent()

    expect(event.version).toBe('2')
    expect(event.type).toBe('ping')
  })

  it('creates v2 session hello events with client capabilities', () => {
    const event = createExternalLinkageHelloEvent()

    expect(event.version).toBe('2')
    expect(event.type).toBe('session.hello')
    expect(event.payload.protocolVersion).toBe('2')
    expect(event.payload.capabilities).toContain('chat.message')
    expect(event.payload.capabilities).toContain('control.cancel')
    expect(event.payload.capabilities).toContain('character.speech.done')
    expect(event.payload.capabilities).toContain('character.response.done')
  })

  it('creates v2 cancel events with a request id', () => {
    const event = createExternalLinkageCancelEvent('msg_active')

    expect(event.type).toBe('control.cancel')
    expect(event.requestId).toBe('msg_active')
  })

  it('creates v2 lifecycle events with a request id', () => {
    const event = createExternalLinkageLifecycleEvent(
      'character.speech.done',
      'msg_active',
      { speechSegmentId: 'speech_1' }
    )

    expect(event.type).toBe('character.speech.done')
    expect(event.requestId).toBe('msg_active')
    expect(event.payload.requestId).toBe('msg_active')
    expect(event.payload.speechSegmentId).toBe('speech_1')
  })

  it('normalizes legacy incoming messages', () => {
    expect(
      normalizeExternalLinkageIncomingMessage({
        text: 'hello',
        role: 'assistant',
        emotion: 'happy',
        type: '',
      })
    ).toEqual({
      text: 'hello',
      role: 'assistant',
      emotion: 'happy',
      type: '',
    })
  })

  it('normalizes v2 chat delta events to the existing message shape', () => {
    expect(
      normalizeExternalLinkageIncomingMessage({
        version: '2',
        type: 'chat.delta',
        payload: {
          text: 'hello',
          role: 'assistant',
          emotion: 'neutral',
        },
        requestId: 'msg_request',
      })
    ).toEqual({
      text: 'hello',
      role: 'assistant',
      emotion: 'neutral',
      type: '',
      requestId: 'msg_request',
      sourceEventType: 'chat.delta',
    })
  })

  it('normalizes v2 session ready control events', () => {
    expect(
      normalizeExternalLinkageControlEvent({
        version: '2',
        id: 'msg_ready',
        type: 'session.ready',
        timestamp: '2026-06-20T00:00:00.000Z',
        payload: {
          protocolVersion: '2',
          capabilities: ['chat.message', 'pong'],
        },
      })
    ).toEqual({
      type: 'session.ready',
      id: 'msg_ready',
      requestId: undefined,
      protocolVersion: '2',
      capabilities: ['chat.message', 'pong'],
      timestamp: '2026-06-20T00:00:00.000Z',
    })
  })

  it('normalizes v2 ack control events', () => {
    expect(
      normalizeExternalLinkageControlEvent({
        version: '2',
        type: 'ack',
        requestId: 'msg_request',
        payload: {},
      })
    ).toEqual({
      type: 'ack',
      id: undefined,
      requestId: 'msg_request',
      timestamp: undefined,
    })
  })

  it('normalizes v2 chat done events as legacy end messages', () => {
    expect(
      normalizeExternalLinkageIncomingMessage({
        version: '2',
        type: 'chat.done',
        requestId: 'msg_request',
        payload: {},
      })
    ).toEqual({
      text: '',
      role: 'assistant',
      emotion: 'neutral',
      type: 'end',
      requestId: 'msg_request',
      sourceEventType: 'chat.done',
    })
  })

  it('ignores non-chat v2 events', () => {
    expect(
      normalizeExternalLinkageIncomingMessage({
        version: '2',
        type: 'session.ready',
        payload: {},
      })
    ).toBeNull()
  })
})
