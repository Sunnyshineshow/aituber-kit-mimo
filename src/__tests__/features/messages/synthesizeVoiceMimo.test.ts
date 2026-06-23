import { synthesizeVoiceMimoApi } from '@/features/messages/synthesizeVoiceMimo'
import type { Talk } from '@/features/messages/messages'

const mockFetch = jest.fn()
global.fetch = mockFetch

describe('synthesizeVoiceMimoApi', () => {
  const mockTalk: Talk = {
    emotion: 'neutral',
    message: 'Hello world',
  }

  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('should send built-in voice request to /api/mimoTTS', async () => {
    const mockBuffer = new ArrayBuffer(8)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    await synthesizeVoiceMimoApi(
      mockTalk,
      'test-key',
      'mimo-v2.5-tts',
      'Chloe',
      'Speak brightly',
      ''
    )

    expect(mockFetch).toHaveBeenCalledWith('/api/mimoTTS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello world',
        apiKey: 'test-key',
        model: 'mimo-v2.5-tts',
        voice: 'Chloe',
        stylePrompt: 'Speak brightly',
        voiceDesignPrompt: '',
      }),
    })
  })

  it('should send voice design request to /api/mimoTTS', async () => {
    const mockBuffer = new ArrayBuffer(8)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    await synthesizeVoiceMimoApi(
      mockTalk,
      'test-key',
      'mimo-v2.5-tts-voicedesign',
      'Chloe',
      'Speak calmly',
      'A warm young narrator voice'
    )

    expect(mockFetch).toHaveBeenCalledWith('/api/mimoTTS', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello world',
        apiKey: 'test-key',
        model: 'mimo-v2.5-tts-voicedesign',
        voice: 'Chloe',
        stylePrompt: 'Speak calmly',
        voiceDesignPrompt: 'A warm young narrator voice',
      }),
    })
  })

  it('should return ArrayBuffer on success', async () => {
    const mockBuffer = new ArrayBuffer(16)
    mockFetch.mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(mockBuffer),
    })

    const result = await synthesizeVoiceMimoApi(
      mockTalk,
      '',
      'mimo-v2.5-tts',
      'Chloe',
      '',
      ''
    )

    expect(result).toBe(mockBuffer)
  })

  it('should throw wrapped error on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
    })

    await expect(
      synthesizeVoiceMimoApi(mockTalk, 'key', 'mimo-v2.5-tts', 'Chloe', '', '')
    ).rejects.toThrow('MiMo TTS')
  })
})
