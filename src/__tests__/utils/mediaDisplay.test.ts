import {
  fitDimensionsWithinBounds,
  getTopRightAnchoredResizeOffset,
} from '@/utils/mediaDisplay'

describe('fitDimensionsWithinBounds', () => {
  it('fits wide media to the maximum width', () => {
    expect(fitDimensionsWithinBounds(2000, 1000, 512, 384)).toEqual({
      width: 512,
      height: 256,
    })
  })

  it('fits tall media to the maximum height', () => {
    expect(fitDimensionsWithinBounds(900, 1600, 512, 384)).toEqual({
      width: 216,
      height: 384,
    })
  })

  it('returns bounds when input dimensions are invalid', () => {
    expect(fitDimensionsWithinBounds(0, 0, 512, 384)).toEqual({
      width: 512,
      height: 384,
    })
  })
})

describe('getTopRightAnchoredResizeOffset', () => {
  const startSize = { width: 400, height: 300 }
  const largerSize = { width: 500, height: 360 }

  it('moves the floating preview when resizing from the right edge', () => {
    expect(
      getTopRightAnchoredResizeOffset('bottom-right', startSize, largerSize)
    ).toEqual({
      x: 100,
      y: 0,
    })
  })

  it('moves the floating preview when resizing from the top edge', () => {
    expect(
      getTopRightAnchoredResizeOffset('top-left', startSize, largerSize)
    ).toEqual({
      x: 0,
      y: -60,
    })
  })

  it('keeps the top-right anchor behavior for the opposite edges', () => {
    expect(
      getTopRightAnchoredResizeOffset('bottom-left', startSize, largerSize)
    ).toEqual({
      x: 0,
      y: 0,
    })
  })
})
