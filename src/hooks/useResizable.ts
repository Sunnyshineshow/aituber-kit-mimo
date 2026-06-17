import { useState, useCallback, useRef, useEffect } from 'react'

interface ResizableOptions {
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
  aspectRatio?: boolean
  initialWidth?: number
  initialHeight?: number
  onResize?: (details: ResizeDetails) => void
  onSizeChange?: (size: { width: number; height: number }) => void
}

export interface ResizeDetails {
  size: { width: number; height: number }
  direction: string
  startSize: { width: number; height: number }
  deltaSize: { width: number; height: number }
}

export const useResizable = (options: ResizableOptions = {}) => {
  const {
    minWidth = 200,
    minHeight = 150,
    maxWidth = typeof window === 'undefined'
      ? 1920
      : Math.max(1920, window.innerWidth * 0.9),
    maxHeight = typeof window === 'undefined'
      ? 1080
      : Math.max(1080, window.innerHeight * 0.9),
    aspectRatio = true,
    initialWidth = 512,
    initialHeight = 384,
    onResize,
    onSizeChange,
  } = options

  const [size, setSizeState] = useState({
    width: initialWidth,
    height: initialHeight,
  })
  const [isResizing, setIsResizing] = useState(false)
  const resizeDirectionRef = useRef<string | null>(null)
  const startSizeRef = useRef({ width: 0, height: 0 })
  const startPosRef = useRef({ x: 0, y: 0 })
  const aspectRatioRef = useRef(4 / 3)

  useEffect(() => {
    if (size.width && size.height) {
      aspectRatioRef.current = size.width / size.height
    }
  }, [size.width, size.height])

  const handleResizeStart = useCallback(
    (e: React.MouseEvent, direction: string) => {
      e.preventDefault()
      e.stopPropagation()
      setIsResizing(true)
      resizeDirectionRef.current = direction
      startSizeRef.current = { ...size }
      startPosRef.current = { x: e.clientX, y: e.clientY }
    },
    [size]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      if (!isResizing || !resizeDirectionRef.current) return

      const deltaX = e.clientX - startPosRef.current.x
      const deltaY = e.clientY - startPosRef.current.y
      const direction = resizeDirectionRef.current

      let newWidth = startSizeRef.current.width
      let newHeight = startSizeRef.current.height

      // Calculate new dimensions based on resize direction
      if (direction.includes('right')) {
        newWidth = startSizeRef.current.width + deltaX
      } else if (direction.includes('left')) {
        newWidth = startSizeRef.current.width - deltaX
      }

      if (direction.includes('bottom')) {
        newHeight = startSizeRef.current.height + deltaY
      } else if (direction.includes('top')) {
        newHeight = startSizeRef.current.height - deltaY
      }

      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value))

      // Maintain aspect ratio if enabled
      if (aspectRatio) {
        const ratio = aspectRatioRef.current || 1
        const applyFromWidth = (candidateWidth: number) => {
          const width = clamp(candidateWidth, minWidth, maxWidth)
          return { width, height: width / ratio }
        }
        const applyFromHeight = (candidateHeight: number) => {
          const height = clamp(candidateHeight, minHeight, maxHeight)
          return { width: height * ratio, height }
        }

        const preferHeight = direction === 'top' || direction === 'bottom'
        const nextSize = preferHeight
          ? applyFromHeight(newHeight)
          : applyFromWidth(newWidth)

        newWidth = nextSize.width
        newHeight = nextSize.height

        if (newWidth > maxWidth) {
          const adjusted = applyFromWidth(maxWidth)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
        if (newHeight > maxHeight) {
          const adjusted = applyFromHeight(maxHeight)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
        if (newWidth < minWidth) {
          const adjusted = applyFromWidth(minWidth)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
        if (newHeight < minHeight) {
          const adjusted = applyFromHeight(minHeight)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
        if (newWidth > maxWidth) {
          const adjusted = applyFromWidth(maxWidth)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
        if (newHeight > maxHeight) {
          const adjusted = applyFromHeight(maxHeight)
          newWidth = adjusted.width
          newHeight = adjusted.height
        }
      } else {
        newWidth = clamp(newWidth, minWidth, maxWidth)
        newHeight = clamp(newHeight, minHeight, maxHeight)
      }

      const nextSize = { width: newWidth, height: newHeight }
      setSizeState(nextSize)
      onResize?.({
        size: nextSize,
        direction,
        startSize: startSizeRef.current,
        deltaSize: {
          width: newWidth - startSizeRef.current.width,
          height: newHeight - startSizeRef.current.height,
        },
      })
    },
    [
      isResizing,
      minWidth,
      minHeight,
      maxWidth,
      maxHeight,
      aspectRatio,
      onResize,
    ]
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
    resizeDirectionRef.current = null
    onSizeChange?.(size)
  }, [size, onSizeChange])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)

      const getCursorForDirection = (direction: string) => {
        if (direction.includes('right') && direction.includes('top'))
          return 'nesw-resize'
        if (direction.includes('right') && direction.includes('bottom'))
          return 'nwse-resize'
        if (direction.includes('left') && direction.includes('top'))
          return 'nwse-resize'
        if (direction.includes('left') && direction.includes('bottom'))
          return 'nesw-resize'
        if (direction.includes('right') || direction.includes('left'))
          return 'ew-resize'
        return 'ns-resize'
      }
      document.body.style.cursor = getCursorForDirection(
        resizeDirectionRef.current || ''
      )

      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = 'auto'
      }
    }
  }, [isResizing, handleResizeMove, handleResizeEnd])

  const resetSize = useCallback(() => {
    setSizeState({ width: initialWidth, height: initialHeight })
  }, [initialWidth, initialHeight])

  const setSize = useCallback((nextSize: { width: number; height: number }) => {
    setSizeState((currentSize) => {
      if (
        currentSize.width === nextSize.width &&
        currentSize.height === nextSize.height
      ) {
        return currentSize
      }
      return nextSize
    })
  }, [])

  return {
    size,
    isResizing,
    handleResizeStart,
    resetSize,
    setSize,
  }
}
