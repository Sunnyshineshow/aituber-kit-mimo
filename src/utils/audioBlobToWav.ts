const writeString = (view: DataView, offset: number, value: string) => {
  for (let i = 0; i < value.length; i++) {
    view.setUint8(offset + i, value.charCodeAt(i))
  }
}

const clampSample = (sample: number) => Math.max(-1, Math.min(1, sample))

export const encodeAudioBufferToWav = (audioBuffer: AudioBuffer) => {
  const sampleRate = audioBuffer.sampleRate
  const channelCount = audioBuffer.numberOfChannels
  const frameCount = audioBuffer.length
  const bytesPerSample = 2
  const blockAlign = channelCount * bytesPerSample
  const dataSize = frameCount * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channelCount, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  const channels = Array.from({ length: channelCount }, (_, index) =>
    audioBuffer.getChannelData(index)
  )

  let offset = 44
  for (let i = 0; i < frameCount; i++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = clampSample(channels[channel][i])
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      )
      offset += bytesPerSample
    }
  }

  return buffer
}

export const convertAudioBlobToWav = async (audioBlob: Blob): Promise<Blob> => {
  const AudioContextClass =
    window.AudioContext || (window as any).webkitAudioContext

  if (!AudioContextClass) {
    throw new Error('AudioContext is not supported in this browser')
  }

  const audioContext = new AudioContextClass()

  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    return new Blob([encodeAudioBufferToWav(audioBuffer)], {
      type: 'audio/wav',
    })
  } finally {
    await audioContext.close().catch(() => undefined)
  }
}

export const ensureMimoCompatibleAudioBlob = async (
  audioBlob: Blob
): Promise<Blob> => {
  if (
    audioBlob.type.includes('audio/wav') ||
    audioBlob.type.includes('audio/mpeg') ||
    audioBlob.type.includes('audio/mp3')
  ) {
    return audioBlob
  }

  return convertAudioBlobToWav(audioBlob)
}
