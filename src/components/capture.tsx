import { useRef, useState, useEffect, useCallback } from 'react'
import homeStore from '@/features/stores/home'
import CaptureService from '@/features/gameCommentary/captureService'
import { VideoDisplay } from './common/VideoDisplay'

let initialCaptureStream: MediaStream | null = null

export const setInitialCaptureStream = (stream: MediaStream) => {
  initialCaptureStream = stream
}

const consumeInitialCaptureStream = () => {
  const stream = initialCaptureStream
  initialCaptureStream = null
  return stream
}

const Capture = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const captureStartedRef = useRef<boolean>(false)

  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)
  const [permissionGranted, setPermissionGranted] = useState<boolean>(false)
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(true)

  // 初回のみ許可を要求するために useRef で状態を保持
  const requestCapturePermissionAttempted = useRef<boolean>(false)

  // ストリームのクリーンアップを一元管理する関数
  const cleanupStream = useCallback((updateState = true) => {
    if (mediaStreamRef.current) {
      const tracks = mediaStreamRef.current.getTracks()
      tracks.forEach((track) => track.stop())
      mediaStreamRef.current = null
    }
    if (updateState) {
      setMediaStream(null)
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
      setMediaStream(stream)
      captureStartedRef.current = true
      homeStore.setState({ captureStatus: true })

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
      const stream = consumeInitialCaptureStream()
      if (stream) {
        setupStream(stream)
          .then(() => {
            setPermissionGranted(true)
            setShowPermissionModal(false)
          })
          .catch((error) => {
            console.error('Error capturing display:', error)
            cleanupStream()
          })
      } else {
        requestCapturePermission()
      }
      requestCapturePermissionAttempted.current = true
    }
  }, [cleanupStream, permissionGranted, requestCapturePermission, setupStream])

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
      cleanupStream(false)
    }
  }, [cleanupStream])

  return (
    <VideoDisplay
      videoRef={videoRef}
      mediaStream={mediaStream}
      onToggleSource={startCapture}
      toggleSourceIcon="24/Reload"
      showToggleButton={true}
    />
  )
}

export default Capture
