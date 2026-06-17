export const fitDimensionsWithinBounds = (
  sourceWidth: number,
  sourceHeight: number,
  maxWidth: number,
  maxHeight: number
) => {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    maxWidth <= 0 ||
    maxHeight <= 0
  ) {
    return { width: maxWidth, height: maxHeight }
  }

  const aspectRatio = sourceWidth / sourceHeight
  const widthFromMaxHeight = maxHeight * aspectRatio

  if (widthFromMaxHeight <= maxWidth) {
    return {
      width: Math.max(1, Math.round(widthFromMaxHeight)),
      height: maxHeight,
    }
  }

  return {
    width: maxWidth,
    height: Math.max(1, Math.round(maxWidth / aspectRatio)),
  }
}

export const getTopRightAnchoredResizeOffset = (
  direction: string,
  startSize: { width: number; height: number },
  nextSize: { width: number; height: number }
) => ({
  x: direction.includes('right') ? nextSize.width - startSize.width : 0,
  y: direction.includes('top') ? startSize.height - nextSize.height : 0,
})
