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
import {
  fitDimensionsWithinBounds,
  getTopRightAnchoredResizeOffset,
} from '@/utils/mediaDisplay'

interface VideoDisplayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  mediaStream?: MediaStream | null
  onCapture?: () => void
  onToggleSource?: () => void
  toggleSourceIcon?: string
  toggleSourceDisabled?: boolean
  showToggleButton?: boolean
  className?: string
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
    const containerRef = useRef<HTMLDivElement>(null)
    const resizeStartPositionRef = useRef({ x: 0, y: 0 })
    const [previewMaxSize, setPreviewMaxSize] = useState({
      width: MINI_VIDEO_MAX_WIDTH,
      height: MINI_VIDEO_MAX_HEIGHT,
    })
    const [videoBounds, setVideoBounds] = useState({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    })
    const {
      position: dragPosition,
      isMobile,
      handleMouseDown,
      resetPosition,
      setPosition: setDragPosition,
      style: dragStyle,
    } = useDraggable()
    const handleResize = useCallback(
      ({
        direction,
        startSize,
        size: nextSize,
      }: {
        direction: string
        startSize: { width: number; height: number }
        size: { width: number; height: number }
      }) => {
        const offset = getTopRightAnchoredResizeOffset(
          direction,
          startSize,
          nextSize
        )

        setDragPosition({
          x: resizeStartPositionRef.current.x + offset.x,
          y: resizeStartPositionRef.current.y + offset.y,
        })
      },
      [setDragPosition]
    )
    const { size, isResizing, handleResizeStart, setSize } = useResizable({
      initialWidth: MINI_VIDEO_MAX_WIDTH,
      initialHeight: MINI_VIDEO_MAX_HEIGHT,
      maxWidth: previewMaxSize.width,
      maxHeight: previewMaxSize.height,
      aspectRatio: true,
      onResize: handleResize,
    })
    const showBackgroundVideo = useVideoAsBackground && !hideVideoDisplay
    const showFloatingPreview = !useVideoAsBackground && !hideVideoDisplay

    const handleVideoResizeStart = useCallback(
      (e: React.MouseEvent, direction: string) => {
        resizeStartPositionRef.current = dragPosition
        handleResizeStart(e, direction)
      },
      [dragPosition, handleResizeStart]
    )

    useEffect(() => {
      const updatePreviewMaxSize = () => {
        setPreviewMaxSize({
          width: Math.max(
            MINI_VIDEO_MAX_WIDTH,
            Math.floor(window.innerWidth * 0.9)
          ),
          height: Math.max(
            MINI_VIDEO_MAX_HEIGHT,
            Math.floor(window.innerHeight * 0.8)
          ),
        })
      }

      updatePreviewMaxSize()
      window.addEventListener('resize', updatePreviewMaxSize)

      return () => {
        window.removeEventListener('resize', updatePreviewMaxSize)
      }
    }, [])

    const syncSizeToVideo = useCallback(() => {
      const video = videoRef.current
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) return

      setSize(
        fitDimensionsWithinBounds(
          video.videoWidth,
          video.videoHeight,
          Math.min(MINI_VIDEO_MAX_WIDTH, previewMaxSize.width),
          Math.min(MINI_VIDEO_MAX_HEIGHT, previewMaxSize.height)
        )
      )
    }, [previewMaxSize.height, previewMaxSize.width, setSize, videoRef])

    // Handle background video sync
    useEffect(() => {
      const backgroundVideo = backgroundVideoRef.current
      if (showBackgroundVideo && videoRef.current?.srcObject) {
        if (backgroundVideo) {
          backgroundVideo.srcObject = videoRef.current.srcObject
        }
      } else if (!showBackgroundVideo) {
        if (backgroundVideo) {
          backgroundVideo.srcObject = null
        }
      }

      return () => {
        if (backgroundVideo) {
          backgroundVideo.srcObject = null
        }
      }
      // videoRef is stable here; mediaStream changes are synchronized by the next effect.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showBackgroundVideo])

    // Handle media stream updates
    useEffect(() => {
      if (mediaStream && showBackgroundVideo && backgroundVideoRef.current) {
        backgroundVideoRef.current.srcObject = mediaStream
        backgroundVideoRef.current.play().catch(console.error)
      }
    }, [mediaStream, showBackgroundVideo])

    const handleCapture = useCallback(() => {
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
    }, [videoRef, onCapture])

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
      if (!containerRef.current) return

      const container = containerRef.current
      const video = videoRef.current
      if (!video || video.videoHeight === 0 || video.videoWidth === 0) {
        setVideoBounds({
          x: 0,
          y: 0,
          width: container.clientWidth,
          height: container.clientHeight,
        })
        return
      }

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

    const resizeBounds =
      videoBounds.width > 0 && videoBounds.height > 0
        ? videoBounds
        : {
            x: 0,
            y: 0,
            width: size.width,
            height: size.height,
          }

    return (
      <>
        {showBackgroundVideo && (
          <video
            ref={backgroundVideoRef}
            autoPlay
            playsInline
            muted
            className="fixed top-0 left-0 w-full h-full object-cover -z-10"
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
                useVideoAsBackground ? 'invisible' : ''
              }`}
            />
            {/* Resize handles */}
            {showFloatingPreview && !isMobile && (
              <>
                {/* Corner handles */}
                <div
                  className="absolute w-3 h-3 cursor-nwse-resize"
                  style={{
                    left: `${resizeBounds.x}px`,
                    top: `${resizeBounds.y}px`,
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'top-left')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nesw-resize"
                  style={{
                    left: `${resizeBounds.x + resizeBounds.width - 12}px`,
                    top: `${resizeBounds.y}px`,
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'top-right')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nesw-resize"
                  style={{
                    left: `${resizeBounds.x}px`,
                    top: `${resizeBounds.y + resizeBounds.height - 12}px`,
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'bottom-left')}
                />
                <div
                  className="absolute w-3 h-3 cursor-nwse-resize"
                  style={{
                    left: `${resizeBounds.x + resizeBounds.width - 12}px`,
                    top: `${resizeBounds.y + resizeBounds.height - 12}px`,
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'bottom-right')}
                />
                {/* Edge handles */}
                <div
                  className="absolute w-1/3 h-2 cursor-ns-resize"
                  style={{
                    left: `${resizeBounds.x + resizeBounds.width / 2}px`,
                    top: `${resizeBounds.y}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'top')}
                />
                <div
                  className="absolute w-1/3 h-2 cursor-ns-resize"
                  style={{
                    left: `${resizeBounds.x + resizeBounds.width / 2}px`,
                    top: `${resizeBounds.y + resizeBounds.height - 8}px`,
                    transform: 'translateX(-50%)',
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'bottom')}
                />
                <div
                  className="absolute w-2 h-1/3 cursor-ew-resize"
                  style={{
                    left: `${resizeBounds.x}px`,
                    top: `${resizeBounds.y + resizeBounds.height / 2}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'left')}
                />
                <div
                  className="absolute w-2 h-1/3 cursor-ew-resize"
                  style={{
                    left: `${resizeBounds.x + resizeBounds.width - 8}px`,
                    top: `${resizeBounds.y + resizeBounds.height / 2}px`,
                    transform: 'translateY(-50%)',
                  }}
                  onMouseDown={(e) => handleVideoResizeStart(e, 'right')}
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
