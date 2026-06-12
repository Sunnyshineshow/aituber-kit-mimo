import { useRef, useState, useEffect, useCallback } from 'react'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import CaptureService from '@/features/gameCommentary/captureService'
import { GAME_COMMENTARY_DELAY_BUFFER_WIDTH } from '@/features/gameCommentary/gameCommentaryTypes'
import { VideoDisplay } from './common/VideoDisplay'

const Capture = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const captureStartedRef = useRef<boolean>(false)

  const delayCanvasRef = useRef<HTMLCanvasElement>(null)
  const currentDelayedFrameRef = useRef<ImageBitmap | null>(null)

  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(true)

  // 初回のみ許可を要求するために useRef で状態を保持
  const requestCapturePermissionAttempted = useRef<boolean>(false)

  // ストリームのクリーンアップを一元管理する関数
  const cleanupStream = useCallback(() => {
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    captureStartedRef.current = false
    homeStore.setState({ captureStatus: false })

    // CaptureServiceのキャプチャ関数を解除
    CaptureService.getInstance().registerCaptureFunction(null)

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // ストリームの設定を一元管理する関数
  const setupStream = useCallback(
    async (stream: MediaStream) => {
      mediaStreamRef.current = stream
      captureStartedRef.current = true
      homeStore.setState({ captureStatus: true })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      // CaptureServiceにキャプチャ関数を登録
      // リサイズはvideo要素から直接スケーリング描画する（Imageのデコード待ちが不要で同期的に完結する）
      CaptureService.getInstance().registerCaptureFunction(
        (maxWidth?: number, quality?: number) => {
          const video = videoRef.current
          if (!video || video.readyState < 2) return null
          const sourceWidth = video.videoWidth
          const sourceHeight = video.videoHeight
          if (!sourceWidth || !sourceHeight) return null

          const scale =
            maxWidth && maxWidth > 0 && sourceWidth > maxWidth
              ? maxWidth / sourceWidth
              : 1
          const canvas = document.createElement('canvas')
          canvas.width = Math.round(sourceWidth * scale)
          canvas.height = Math.round(sourceHeight * scale)
          const ctx = canvas.getContext('2d')
          if (!ctx) return null
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          return canvas.toDataURL('image/jpeg', quality ?? 0.9)
        }
      )

      // track endedイベント監視（ブラウザ側で共有停止された時の検知）
      stream.getVideoTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          cleanupStream()
        })
      })
    },
    [cleanupStream]
  )

  // Capture permission request
  const requestCapturePermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices) {
        throw new Error('Media Devices API non supported.')
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      })
      await setupStream(stream)
      setPermissionGranted(true)
      setShowPermissionModal(false)
    } catch (error) {
      console.error('Error capturing display:', error)
      setShowPermissionModal(true)
      cleanupStream()
    }
  }, [setupStream, cleanupStream])

  useEffect(() => {
    // 初回のみ許可を要求
    if (!requestCapturePermissionAttempted.current && !permissionGranted) {
      requestCapturePermission()
      requestCapturePermissionAttempted.current = true
    }
  }, [permissionGranted, requestCapturePermission])

  const startCapture = async () => {
    // すでに画面共有中の場合は停止
    if (captureStartedRef.current) {
      cleanupStream()
      return
    }

    // 新たに画面共有を開始
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
      })
      await setupStream(stream)
    } catch (error) {
      console.error('Error capturing display:', error)
      cleanupStream()
    }
  }

  useEffect(() => {
    return () => {
      cleanupStream()
    }
  }, [cleanupStream])

  // 映像遅延フレームバッファ
  const gameCommentaryEnabled = settingsStore((s) => s.gameCommentaryEnabled)
  const gameCommentaryVideoDelay = settingsStore(
    (s) => s.gameCommentaryVideoDelay
  )
  const isVideoDelayed =
    gameCommentaryEnabled && (gameCommentaryVideoDelay ?? 0) > 0
  const videoDelaySeconds = gameCommentaryVideoDelay ?? 0
  const bufferWidth = GAME_COMMENTARY_DELAY_BUFFER_WIDTH

  useEffect(() => {
    if (!isVideoDelayed || videoDelaySeconds <= 0) return

    const CAPTURE_FPS = 15
    const CAPTURE_INTERVAL_MS = 1000 / CAPTURE_FPS

    const frameBuffer: { bitmap: ImageBitmap; time: number }[] = []
    const offscreen = document.createElement('canvas')
    const offCtx = offscreen.getContext('2d')
    let animId = 0
    let lastCapture = 0

    const loop = () => {
      const video = videoRef.current
      const canvas = delayCanvasRef.current

      if (video && canvas && video.readyState >= 2 && offCtx) {
        const now = performance.now()

        // 固定レートでフレームをキャプチャ
        if (now - lastCapture >= CAPTURE_INTERVAL_MS) {
          lastCapture = now
          const captureTime = now

          const aspect = video.videoWidth / video.videoHeight
          const bufW = bufferWidth
          const bufH = Math.round(bufferWidth / (aspect || 1))

          if (offscreen.width !== bufW) offscreen.width = bufW
          if (offscreen.height !== bufH) offscreen.height = bufH

          offCtx.drawImage(video, 0, 0, bufW, bufH)

          createImageBitmap(offscreen).then((bitmap) => {
            frameBuffer.push({ bitmap, time: captureTime })

            // 古いフレームを削除（遅延+2秒分のバッファを保持）
            const cutoff = performance.now() - (videoDelaySeconds + 2) * 1000
            while (frameBuffer.length > 0 && frameBuffer[0].time < cutoff) {
              frameBuffer[0].bitmap.close()
              frameBuffer.shift()
            }
          })
        }

        // 遅延フレームを描画
        const targetTime = performance.now() - videoDelaySeconds * 1000
        let frameToShow: ImageBitmap | null = null

        for (let i = frameBuffer.length - 1; i >= 0; i--) {
          if (frameBuffer[i].time <= targetTime) {
            frameToShow = frameBuffer[i].bitmap
            break
          }
        }

        // 現在の遅延フレームを保持（背景描画用）
        currentDelayedFrameRef.current = frameToShow

        if (frameToShow) {
          const displayW = canvas.clientWidth
          const displayH = canvas.clientHeight
          const dpr = window.devicePixelRatio || 1
          const canvasW = Math.round(displayW * dpr)
          const canvasH = Math.round(displayH * dpr)

          if (canvas.width !== canvasW || canvas.height !== canvasH) {
            canvas.width = canvasW
            canvas.height = canvasH
          }

          const ctx = canvas.getContext('2d')
          if (ctx) {
            // video要素のデフォルト(object-fit: fill)と同じ挙動で描画
            ctx.drawImage(frameToShow, 0, 0, canvasW, canvasH)
          }
        }
      }

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(animId)
      for (const frame of frameBuffer) {
        frame.bitmap.close()
      }
      frameBuffer.length = 0
      currentDelayedFrameRef.current = null
    }
  }, [isVideoDelayed, videoDelaySeconds, bufferWidth])

  return (
    <VideoDisplay
      videoRef={videoRef}
      mediaStream={mediaStreamRef.current}
      onToggleSource={startCapture}
      toggleSourceIcon="24/Reload"
      showToggleButton={true}
      delayCanvasRef={delayCanvasRef}
      isVideoDelayed={isVideoDelayed}
      delayedFrameRef={currentDelayedFrameRef}
    />
  )
}

export default Capture
