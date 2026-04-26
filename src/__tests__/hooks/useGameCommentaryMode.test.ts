/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGameCommentaryMode } from '@/hooks/useGameCommentaryMode'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { generateGameCommentary } from '@/features/gameCommentary/generateGameCommentary'
import { SpeakQueue } from '@/features/messages/speakQueue'

const mockCaptureFrame = jest.fn(() => 'data:image/jpeg;base64,test')
const mockCaptureAvailable = jest.fn(() => true)
const mockGenerateGameCommentary = generateGameCommentary as jest.Mock
const mockStopSession = SpeakQueue.stopSession as jest.Mock
const mockSpeakCharacter = jest.fn()

let settingsState: Record<string, unknown>
let homeState: Record<string, unknown>
let homeSubscriber:
  | ((state: typeof homeState, prevState: typeof homeState) => void)
  | undefined

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

jest.mock('@/features/stores/settings', () => {
  const mockFn = jest.fn()
  return {
    __esModule: true,
    default: Object.assign(mockFn, {
      getState: jest.fn(),
      setState: jest.fn(),
      subscribe: jest.fn(() => jest.fn()),
    }),
  }
})

jest.mock('@/features/stores/home', () => ({
  __esModule: true,
  default: {
    getState: jest.fn(),
    setState: jest.fn(),
    subscribe: jest.fn((callback: typeof homeSubscriber) => {
      homeSubscriber = callback
      return jest.fn()
    }),
  },
}))

jest.mock('@/features/gameCommentary/captureService', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({
      isAvailable: mockCaptureAvailable,
      captureFrame: mockCaptureFrame,
    }),
  },
}))

jest.mock('@/features/gameCommentary/generateGameCommentary', () => ({
  __esModule: true,
  generateGameCommentary: jest.fn(),
}))

jest.mock('@/features/messages/speakCharacter', () => ({
  speakCharacter: (...args: unknown[]) => mockSpeakCharacter(...args),
}))

jest.mock('@/features/messages/speakQueue', () => ({
  SpeakQueue: {
    getInstance: jest.fn(() => ({
      addTask: jest.fn(),
      clearQueue: jest.fn(),
      checkSessionId: jest.fn(),
    })),
    stopAll: jest.fn(),
    stopSession: jest.fn(),
    onSpeakCompletion: jest.fn(),
    removeSpeakCompletionCallback: jest.fn(),
  },
}))

function setupSettingsState(overrides: Record<string, unknown> = {}) {
  settingsState = {
    gameCommentaryEnabled: true,
    gameCommentaryPlaying: true,
    gameCommentaryCaptureInterval: 5,
    gameCommentaryContextCount: 5,
    maxPastMessages: 10,
    gameCommentaryImageQuality: 0.7,
    gameCommentaryResizeWidth: 1024,
    gameCommentaryBackgroundAnalysisEnabled: false,
    gameCommentaryBackgroundAnalysisInterval: 2,
    gameCommentarySaveToChat: false,
    ...overrides,
  }

  const mockedSettingsStore = settingsStore as unknown as jest.Mock & {
    getState: jest.Mock
  }
  mockedSettingsStore.mockImplementation(
    (selector: (state: typeof settingsState) => unknown) =>
      selector ? selector(settingsState) : settingsState
  )
  mockedSettingsStore.getState.mockImplementation(() => settingsState)
}

function setupHomeState(overrides: Record<string, unknown> = {}) {
  homeState = {
    chatProcessing: false,
    chatProcessingCount: 0,
    isSpeaking: false,
    captureStatus: true,
    chatLog: [],
    upsertMessage: jest.fn(),
    ...overrides,
  }

  const mockedHomeStore = homeStore as unknown as {
    getState: jest.Mock
    setState: jest.Mock
  }
  mockedHomeStore.getState.mockImplementation(() => homeState)
  mockedHomeStore.setState.mockImplementation(
    (
      partial:
        | Partial<typeof homeState>
        | ((state: typeof homeState) => Partial<typeof homeState>)
    ) => {
      const update =
        typeof partial === 'function' ? partial(homeState) : partial
      homeState = { ...homeState, ...update }
    }
  )
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('useGameCommentaryMode', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    homeSubscriber = undefined
    setupSettingsState()
    setupHomeState()
    mockGenerateGameCommentary.mockResolvedValue({
      text: '実況テストです。',
      emotion: 'neutral',
      sceneDescription: 'テストシーン',
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('reschedules commentary after a user chat interrupts speaking', async () => {
    const { result } = renderHook(() => useGameCommentaryMode({}))

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.state).toBe('speaking')
    })

    expect(mockGenerateGameCommentary).toHaveBeenCalledTimes(1)
    expect(homeSubscriber).toBeDefined()

    const prevState = homeState
    const nextState = {
      ...homeState,
      chatLog: [
        {
          id: 'user-1',
          role: 'user',
          content: '今どうなってる？',
          timestamp: new Date().toISOString(),
        },
      ],
    }

    await act(async () => {
      homeState = nextState
      homeSubscriber?.(nextState, prevState)
      await Promise.resolve()
    })

    expect(mockStopSession).toHaveBeenCalledWith(
      expect.stringMatching(/^game-commentary-/)
    )
    expect(result.current.state).toBe('waiting')
    expect(result.current.secondsUntilNextCapture).toBe(5)

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await flushAsync()

    expect(mockGenerateGameCommentary).toHaveBeenCalledTimes(2)
  })

  it('cancels an in-flight commentary generation when a user chat arrives during capturing', async () => {
    const deferred = createDeferred<{
      text: string
      emotion: string
      sceneDescription: string
    }>()
    mockGenerateGameCommentary.mockReturnValueOnce(deferred.promise)

    const { result } = renderHook(() => useGameCommentaryMode({}))

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.state).toBe('capturing')
    })

    const prevState = homeState
    const nextState = {
      ...homeState,
      chatLog: [
        {
          id: 'user-capturing',
          role: 'user',
          content: '割り込みです',
          timestamp: new Date().toISOString(),
        },
      ],
    }

    await act(async () => {
      homeState = nextState
      homeSubscriber?.(nextState, prevState)
      await Promise.resolve()
    })

    expect(mockStopSession).toHaveBeenCalledWith(null)
    expect(result.current.state).toBe('waiting')
    expect(mockGenerateGameCommentary.mock.calls[0][4].signal.aborted).toBe(
      true
    )

    await act(async () => {
      deferred.resolve({
        text: '古い実況です。',
        emotion: 'neutral',
        sceneDescription: '古いシーン',
      })
      await deferred.promise
      await Promise.resolve()
    })

    expect(mockSpeakCharacter).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await flushAsync()

    expect(mockGenerateGameCommentary).toHaveBeenCalledTimes(2)
  })

  it('cancels an in-flight commentary generation when another chat process starts', async () => {
    const deferred = createDeferred<{
      text: string
      emotion: string
      sceneDescription: string
    }>()
    mockGenerateGameCommentary.mockReturnValueOnce(deferred.promise)

    const { result } = renderHook(() => useGameCommentaryMode({}))

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await waitFor(() => {
      expect(result.current.state).toBe('capturing')
    })

    const prevState = homeState
    const nextState = {
      ...homeState,
      chatProcessing: true,
    }

    await act(async () => {
      homeState = nextState
      homeSubscriber?.(nextState, prevState)
      await Promise.resolve()
    })

    expect(mockStopSession).toHaveBeenCalledWith(null)
    expect(result.current.state).toBe('waiting')
    expect(mockGenerateGameCommentary.mock.calls[0][4].signal.aborted).toBe(
      true
    )
  })

  it('uses maxPastMessages for recent chat context during commentary generation', async () => {
    setupSettingsState({ maxPastMessages: 3 })
    setupHomeState({
      chatLog: [
        { id: '1', role: 'user', content: 'm1', timestamp: '2026-01-01' },
        { id: '2', role: 'assistant', content: 'm2', timestamp: '2026-01-01' },
        { id: '3', role: 'user', content: 'm3', timestamp: '2026-01-01' },
        { id: '4', role: 'assistant', content: 'm4', timestamp: '2026-01-01' },
        { id: '5', role: 'user', content: 'm5', timestamp: '2026-01-01' },
      ],
    })

    renderHook(() => useGameCommentaryMode({}))

    await act(async () => {
      jest.advanceTimersByTime(5000)
      await Promise.resolve()
    })

    await flushAsync()

    expect(mockGenerateGameCommentary).toHaveBeenCalledWith(
      expect.any(Array),
      'data:image/jpeg;base64,test',
      [
        { role: 'user', content: 'm3' },
        { role: 'assistant', content: 'm4' },
        { role: 'user', content: 'm5' },
      ],
      [],
      expect.objectContaining({ signal: expect.any(Object) })
    )
  })

  it('uses a runtime lower bound when capture interval is set to zero', async () => {
    setupSettingsState({ gameCommentaryCaptureInterval: 0 })

    renderHook(() => useGameCommentaryMode({}))

    await act(async () => {
      jest.advanceTimersByTime(2999)
      await Promise.resolve()
    })

    expect(mockGenerateGameCommentary).not.toHaveBeenCalled()

    await act(async () => {
      jest.advanceTimersByTime(1)
      await Promise.resolve()
    })

    await flushAsync()

    expect(mockGenerateGameCommentary).toHaveBeenCalledTimes(1)
  })
})
