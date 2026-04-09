import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import homeStore from '@/features/stores/home'
import settingsStore from '@/features/stores/settings'
import { IconButton } from '../iconButton'
import { useDraggable } from '@/hooks/useDraggable'
import { useResizable } from '@/hooks/useResizable'
import { fitDimensionsWithinBounds } from '@/utils/mediaDisplay'

interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  mediaStream?: MediaStream | null
  onCapture?: () => void
  onToggleSource?: () => void
  toggleSourceIcon?: string
  toggleSourceDisabled?: boolean
  showToggleButton?: boolean
  className?: string
  delayCanvasRef?: React.RefObject<HTMLCanvasElement>
  isVideoDelayed?: boolean
  delayedFrameRef?: React.RefObject<ImageBitmap | null>
}

export const VideoDisplay = forwardRef<HTMLDivElement, VideoDisplayProps>(
  (
    {
      videoRef,
      mediaStream,
      onCapture,
      onToggleSource,
      toggleSourceIcon = '24/Roll',
      toggleSourceDisabled = false,
      showToggleButton = true,
      className = '',
      delayCanvasRef,
      isVideoDelayed = false,
      delayedFrameRef,
    },
    ref
  ) => {
    const MINI_VIDEO_MAX_WIDTH = 512
    const MINI_VIDEO_MAX_HEIGHT = 384
    const { t } = useTranslation()
    const triggerShutter = homeStore((s) => s.triggerShutter)
    const useVideoAsBackground = settingsStore((s) => s.useVideoAsBackground)
    const hideVideoDisplay = settingsStore((s) => s.hideVideoDisplay)
    const backgroundVideoRef = useRef<HTMLVideoElement>(null)
    const delayBackgroundCanvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const [videoBounds, setVideoBounds] = useState({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
    const {
      isMobile,
      handleMouseDown,
      resetPosition,
      style: dragStyle,
    } = useDraggable()
    const { size, isResizing, handleResizeStart, setSize } = useResizable({
      initialWidth: MINI_VIDEO_MAX_WIDTH,
      initialHeight: MINI_VIDEO_MAX_HEIGHT,
      maxWidth: MINI_VIDEO_MAX_WIDTH,
      maxHeight: MINI_VIDEO_MAX_HEIGHT,
      aspectRatio: true,
    })
    const showBackgroundVideo = useVideoAsBackground && !hideVideoDisplay
    const showFloatingPreview = !useVideoAsBackground && !hideVideoDisplay

    const syncSizeToVideo = useCallback(() => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

      setSize(
        fitDimensionsWithinBounds(
          video.videoWidth,
          video.videoHeight,
          MINI_VIDEO_MAX_WIDTH,
          MINI_VIDEO_MAX_HEIGHT
        )
      )
    }, [setSize, videoRef])

    // Handle background video sync (skip when delayed - uses canvas instead)
    useEffect(() => {
      if (isVideoDelayed) return
      if (showBackgroundVideo && videoRef.current?.srcObject) {
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.srcObject = videoRef.current.srcObject
        }
      } else if (!showBackgroundVideo) {
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.srcObject = null
        }
      }

      return () => {
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.srcObject = null
        }
      }
    }, [showBackgroundVideo, videoRef, isVideoDelayed])

    // Handle media stream updates (skip when delayed)
    useEffect(() => {
      if (isVideoDelayed) return
      if (mediaStream && showBackgroundVideo && backgroundVideoRef.current) {
        backgroundVideoRef.current.srcObject = mediaStream
        backgroundVideoRef.current.play().catch(console.error)
      }
    }, [mediaStream, showBackgroundVideo, isVideoDelayed])

    // 遅延映像を背景canvasに直接描画（ImageBitmapから直接描画で高画質）
    useEffect(() => {
      if (!isVideoDelayed || !showBackgroundVideo) return
      const bgCanvas = delayBackgroundCanvasRef.current
      if (!bgCanvas) return

      let animId: number
      const copy = () => {
        const frame = delayedFrameRef?.current
        if (frame) {
          const dpr = window.devicePixelRatio || 1
          const w = Math.round(window.innerWidth * dpr)
          const h = Math.round(window.innerHeight * dpr)
          if (bgCanvas.width !== w || bgCanvas.height !== h) {
            bgCanvas.width = w
            bgCanvas.height = h
          }
          const ctx = bgCanvas.getContext('2d')
          if (ctx) {
            // object-cover 的な描画（画面全体を埋める）
            const srcAspect = frame.width / frame.height
            const dstAspect = w / h
            let sx, sy, sw, sh
            if (srcAspect > dstAspect) {
              sh = frame.height
              sw = frame.height * dstAspect
              sx = (frame.width - sw) / 2
              sy = 0
            } else {
              sw = frame.width
              sh = frame.width / dstAspect
              sx = 0
              sy = (frame.height - sh) / 2
            }
            ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, w, h)
          }
        }
        animId = requestAnimationFrame(copy)
      }
      animId = requestAnimationFrame(copy)
      return () => cancelAnimationFrame(animId)
    }, [isVideoDelayed, showBackgroundVideo, delayedFrameRef])

    const handleCapture = useCallback(() => {
      // 遅延表示中はcanvasからキャプチャ
      if (isVideoDelayed) {
        const delayCanvas = delayCanvasRef?.current
        if (delayCanvas && delayCanvas.width > 0 && delayCanvas.height > 0) {
          const data = delayCanvas.toDataURL('image/png')
          if (data !== '') {
            homeStore.setState({
              modalImage: data,
              triggerShutter: false,
            })
          }
          onCapture?.()
          return
        }

        const delayedFrame = delayedFrameRef?.current
        if (delayedFrame) {
          const canvas = document.createElement('canvas')
          canvas.width = delayedFrame.width
          canvas.height = delayedFrame.height
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          ctx.drawImage(delayedFrame, 0, 0)
          const data = canvas.toDataURL('image/png')
          if (data !== '') {
            homeStore.setState({
              modalImage: data,
              triggerShutter: false,
            })
          } else {
            homeStore.setState({ modalImage: '' })
          }
          onCapture?.()
          return
        }
      }

      if (!videoRef.current) return
      if (
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      )
        return

      const canvas = document.createElement('canvas')
      canvas.width = videoRef.current.videoWidth
      canvas.height = videoRef.current.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      ctx.drawImage(videoRef.current, 0, 0)
      const data = canvas.toDataURL('image/png')

      if (data !== '') {
        console.log('capture')
        homeStore.setState({
          modalImage: data,
          triggerShutter: false,
        })
      } else {
        homeStore.setState({ modalImage: '' })
      }

      onCapture?.()
    }, [videoRef, onCapture, isVideoDelayed, delayCanvasRef, delayedFrameRef])

    useEffect(() => {
      if (triggerShutter) {
        handleCapture()
      }
    }, [triggerShutter, handleCapture])

    const handleExpand = useCallback(() => {
      const nextExpanded = !useVideoAsBackground
      settingsStore.setState({
        useVideoAsBackground: nextExpanded,
        hideVideoDisplay: false,
      })
      resetPosition()
      if (!nextExpanded) {
        syncSizeToVideo()
      }
    }, [resetPosition, syncSizeToVideo, useVideoAsBackground])

    const handleToggleHidden = useCallback(() => {
      settingsStore.setState({ hideVideoDisplay: !hideVideoDisplay })
    }, [hideVideoDisplay])

    // Calculate actual video bounds within container
    const updateVideoBounds = useCallback(() => {
      if (!videoRef.current || !containerRef.current) return

      const video = videoRef.current
      if (video.videoHeight === 0 || video.videoWidth === 0) return

      const container = containerRef.current
      const videoAspectRatio = video.videoWidth / video.videoHeight
      const containerAspectRatio =
        container.clientWidth / container.clientHeight

      let actualWidth: number
      let actualHeight: number
      let offsetX = 0
      let offsetY = 0

      if (videoAspectRatio > containerAspectRatio) {
        // Video is wider than container
        actualWidth = container.clientWidth
        actualHeight = container.clientWidth / videoAspectRatio
        offsetY = 0 // Align to top
      } else {
        // Video is taller than container
        actualHeight = container.clientHeight
        actualWidth = container.clientHeight * videoAspectRatio
        offsetX = (container.clientWidth - actualWidth) / 2
      }

      setVideoBounds({
        x: offsetX,
        y: offsetY,
        width: actualWidth,
        height: actualHeight,
      })
    }, [videoRef])

    // Update bounds when size changes or video loads
    useEffect(() => {
      const video = videoRef.current
      if (!video) return

      const handleLoadedMetadata = () => {
        syncSizeToVideo()
        updateVideoBounds()
      }

      video.addEventListener('loadedmetadata', handleLoadedMetadata)
      syncSizeToVideo()
      updateVideoBounds()

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      }
    }, [videoRef, syncSizeToVideo, updateVideoBounds])

    // Update bounds on resize
    useEffect(() => {
      updateVideoBounds()
    }, [size, updateVideoBounds])

    return (
      <>
        {showBackgroundVideo && !isVideoDelayed && (
          <video
            ref={backgroundVideoRef}
            autoPlay
            playsInline
            muted
            className="fixed top-0 left-0 w-full h-full object-cover -z-10"
          />
        )}
        {showBackgroundVideo && isVideoDelayed && (
          <canvas
            ref={delayBackgroundCanvasRef}
            className="fixed top-0 left-0 w-full h-full -z-10"
          />
        )}
        <div
          ref={ref}
          className={`fixed z-10 ${className} ${
            hideVideoDisplay
              ? 'pointer-events-none opacity-0 -left-[10000px] -top-[10000px]'
              : `right-4 top-4 ${useVideoAsBackground ? 'pointer-events-none' : ''}`
          }`}
          style={{
            ...dragStyle,
            width: useVideoAsBackground ? 'auto' : `${size.width}px`,
            height: useVideoAsBackground ? 'auto' : `${size.height}px`,
            maxWidth: useVideoAsBackground ? '70%' : 'none',
            maxHeight: useVideoAsBackground ? '40vh' : 'none',
          }}
          aria-hidden={hideVideoDisplay}
        >
          <div
            ref={containerRef}
            className="relative w-full h-full select-none"
            onMouseDown={
              !isMobile && !isResizing && showFloatingPreview
                ? handleMouseDown
                : undefined
            }
          >
            <video
              ref={videoRef}
              width={512}
              height={512}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-contain object-top bg-black ${
                useVideoAsBackground || isVideoDelayed ? 'invisible' : ''
              }`}
            />
            {isVideoDelayed && (
              <canvas
                ref={delayCanvasRef}
                className={`absolute top-0 left-0 w-full h-full bg-black ${
                  useVideoAsBackground ? 'invisible' : ''
                }`}
              />
            )}
            {/* Resize handles */}
            {showFloatingPreview && !isMobile && videoBounds.width > 0 && (
              <>
                {/* Corner handles */}
                <div
                  className="absolute w-3 h-3 cursor-nwse-resize"
                  style={{
                    left: `${videoBounds.x}px`,
                    top: `${videoBounds.y}px`,
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'top-left')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nesw-resize"
                  style={{
                    left: `${videoBounds.x + videoBounds.width - 12}px`,
                    top: `${videoBounds.y}px`,
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'top-right')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nesw-resize"
                  style={{
                    left: `${videoBounds.x}px`,
                    top: `${videoBounds.y + videoBounds.height - 12}px`,
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nwse-resize"
                  style={{
                    left: `${videoBounds.x + videoBounds.width - 12}px`,
                    top: `${videoBounds.y + videoBounds.height - 12}px`,
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
                />
                {/* Edge handles */}
                <div
                  className="absolute w-1/3 h-2 cursor-ns-resize"
                  style={{
                    left: `${videoBounds.x + videoBounds.width / 2}px`,
                    top: `${videoBounds.y}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'top')}
                />
                <div
                  className="absolute w-1/3 h-2 cursor-ns-resize"
                  style={{
                    left: `${videoBounds.x + videoBounds.width / 2}px`,
                    top: `${videoBounds.y + videoBounds.height - 8}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'bottom')}
                />
                <div
                  className="absolute w-2 h-1/3 cursor-ew-resize"
                  style={{
                    left: `${videoBounds.x}px`,
                    top: `${videoBounds.y + videoBounds.height / 2}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'left')}
                />
                <div
                  className="absolute w-2 h-1/3 cursor-ew-resize"
                  style={{
                    left: `${videoBounds.x + videoBounds.width - 8}px`,
                    top: `${videoBounds.y + videoBounds.height / 2}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onMouseDown={(e) => handleResizeStart(e, 'right')}
                />
              </>
            )}
            {showFloatingPreview && (
              <div className="md:block absolute top-2 right-2">
                {showToggleButton && (
                  <IconButton
                    iconName={toggleSourceIcon}
                    className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
                    isProcessing={false}
                    disabled={toggleSourceDisabled}
                    onClick={onToggleSource}
                  />
                )}
                <IconButton
                  iconName="24/Expand"
                  className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
                  isProcessing={false}
                  onClick={handleExpand}
                />
                <IconButton
                  iconName="24/Close"
                  className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
                  isProcessing={false}
                  onClick={handleToggleHidden}
                  title={t('HideVideoDisplay')}
                  aria-label={t('HideVideoDisplay')}
                />
                <IconButton
                  iconName="24/Shutter"
                  className="z-30 bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
                  isProcessing={false}
                  onClick={handleCapture}
                />
              </div>
            )}
          </div>
        </div>
        {(useVideoAsBackground || hideVideoDisplay) && (
          <div className="fixed top-4 right-4 z-40 pointer-events-auto">
            {showToggleButton && (
              <IconButton
                iconName={toggleSourceIcon}
                className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
                isProcessing={false}
                disabled={toggleSourceDisabled}
                onClick={onToggleSource}
              />
            )}
            <IconButton
              iconName="24/Expand"
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
              isProcessing={false}
              onClick={handleExpand}
            />
            <IconButton
              iconName={hideVideoDisplay ? '24/Add' : '24/Close'}
              className="bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
              isProcessing={false}
              onClick={handleToggleHidden}
              title={
                hideVideoDisplay ? t('ShowVideoDisplay') : t('HideVideoDisplay')
              }
              aria-label={
                hideVideoDisplay ? t('ShowVideoDisplay') : t('HideVideoDisplay')
              }
            />
            <IconButton
              iconName="24/Shutter"
              className="z-30 bg-secondary hover:bg-secondary-hover active:bg-secondary-press disabled:bg-secondary-disabled m-2"
              isProcessing={false}
              onClick={handleCapture}
            />
          </div>
        )}
      </>
    )
  }
)

VideoDisplay.displayName = 'VideoDisplay'
