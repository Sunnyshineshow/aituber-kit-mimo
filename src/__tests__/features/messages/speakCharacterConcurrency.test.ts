const mockSettingsGetState = jest.fn()
jest.mock('../../../features/stores/settings', () => ({
  getState: (...args: unknown[]) => mockSettingsGetState(...args),
}))

jest.mock('../../../features/stores/home', () => ({
  getState: jest.fn(),
  setState: jest.fn(),
}))

jest.mock('../../../features/stores/toast', () => ({
  getState: () => ({
    addToast: jest.fn(),
  }),
}))

jest.mock('i18next', () => ({
  t: jest.fn((key: string) => key),
}))

const mockAddTask = jest.fn().mockResolvedValue(undefined)
const mockCheckSessionId = jest.fn()
let mockStopToken = 0

jest.mock('../../../features/messages/speakQueue', () => ({
  SpeakQueue: class {
    static getInstance() {
      return {
        addTask: (...args: unknown[]) => mockAddTask(...args),
        checkSessionId: (...args: unknown[]) => mockCheckSessionId(...args),
      }
    }

    static get currentStopToken() {
      return mockStopToken
    }
  },
}))

jest.mock('../../../features/messages/live2dHandler', () => ({
  Live2DHandler: {},
}))

jest.mock('../../../features/pngTuber/pngTuberHandler', () => ({
  PNGTuberHandler: {},
}))

const mockWait = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../utils/wait', () => ({
  wait: (...args: unknown[]) => mockWait(...args),
}))

jest.mock('../../../utils/textProcessing', () => ({
  containsEnglish: jest.fn(() => false),
  asyncConvertEnglishToJapaneseReading: jest.fn((text: string) =>
    Promise.resolve(text)
  ),
}))

const mockSynthesizeVoicevoxApi = jest.fn()
jest.mock('../../../features/messages/synthesizeVoiceVoicevox', () => ({
  synthesizeVoiceVoicevoxApi: (...args: unknown[]) =>
    mockSynthesizeVoicevoxApi(...args),
}))

import { speakCharacter } from '../../../features/messages/speakCharacter'

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('speakCharacter concurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStopToken = 0
    mockSettingsGetState.mockReturnValue({
      audioMode: false,
      changeEnglishToJapanese: false,
      selectLanguage: 'ja',
      selectVoice: 'voicevox',
      voicevoxSpeaker: '1',
      voicevoxSpeed: 1,
      voicevoxPitch: 0,
      voicevoxIntonation: 1,
      voicevoxServerUrl: 'http://localhost:50021',
    })
  })

  it('keeps playback order even when later synthesis finishes first', async () => {
    const first = createDeferred<ArrayBuffer>()
    const second = createDeferred<ArrayBuffer>()

    mockSynthesizeVoicevoxApi
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    speakCharacter('session-1', { message: 'first', emotion: 'neutral' })
    speakCharacter('session-1', { message: 'second', emotion: 'neutral' })

    second.resolve(new ArrayBuffer(2))
    await flushPromises()

    expect(mockAddTask).not.toHaveBeenCalled()

    first.resolve(new ArrayBuffer(1))
    await flushPromises()

    expect(mockAddTask).toHaveBeenCalledTimes(2)
    expect(mockAddTask.mock.calls[0][0]).toMatchObject({
      sessionId: 'session-1',
      talk: expect.objectContaining({ message: 'first' }),
    })
    expect(mockAddTask.mock.calls[1][0]).toMatchObject({
      sessionId: 'session-1',
      talk: expect.objectContaining({ message: 'second' }),
    })
  })

  it('drops old synthesis results after a session switch', async () => {
    const oldTask = createDeferred<ArrayBuffer>()
    const newTask = createDeferred<ArrayBuffer>()
    const oldComplete = jest.fn()
    const newComplete = jest.fn()

    mockSynthesizeVoicevoxApi
      .mockReturnValueOnce(oldTask.promise)
      .mockReturnValueOnce(newTask.promise)

    speakCharacter(
      'session-old',
      { message: 'old', emotion: 'neutral' },
      undefined,
      oldComplete
    )
    speakCharacter(
      'session-new',
      { message: 'new', emotion: 'neutral' },
      undefined,
      newComplete
    )

    oldTask.resolve(new ArrayBuffer(1))
    await flushPromises()

    expect(oldComplete).toHaveBeenCalledTimes(1)
    expect(mockAddTask).not.toHaveBeenCalled()

    newTask.resolve(new ArrayBuffer(1))
    await flushPromises()

    expect(mockAddTask).toHaveBeenCalledTimes(1)
    expect(mockAddTask.mock.calls[0][0]).toMatchObject({
      sessionId: 'session-new',
      talk: expect.objectContaining({ message: 'new' }),
      onComplete: expect.any(Function),
    })
    expect(newComplete).not.toHaveBeenCalled()
  })
})
