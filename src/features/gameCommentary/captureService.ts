/**
 * CaptureService - Screen capture API service (Singleton)
 *
 * Provides a registration-based API for capturing frames from
 * the screen share video element without storing DOM refs in stores.
 */
class CaptureService {
  private static instance: CaptureService
  private captureFrameFn: (() => string | null) | null = null

  private constructor() {}

  static getInstance(): CaptureService {
    if (!CaptureService.instance) {
      CaptureService.instance = new CaptureService()
    }
    return CaptureService.instance
  }

  /**
   * Register a capture function from capture.tsx
   * Pass null to unregister (e.g., on stream cleanup)
   */
  registerCaptureFunction(fn: (() => string | null) | null): void {
    this.captureFrameFn = fn
  }

  /**
   * Capture the current frame, optionally resizing and compressing
   * @param maxWidth - Maximum width to resize to (0 or undefined = no resize)
   * @param quality - JPEG quality (0.0-1.0, default 0.7)
   * @returns Base64 data URL string or null if unavailable
   */
  async captureFrame(
    maxWidth?: number,
    quality?: number
  ): Promise<string | null> {
    const raw = this.captureFrameFn?.() ?? null
    if (!raw) return null
    if (!maxWidth || maxWidth <= 0) return raw

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = raw
      })

      if (img.width <= maxWidth) return raw

      const scale = maxWidth / img.width
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = Math.round(img.height * scale)

      const ctx = canvas.getContext('2d')
      if (!ctx) return raw

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', quality ?? 0.7)
    } catch {
      return raw
    }
  }

  /**
   * Check if a capture function is registered and available
   */
  isAvailable(): boolean {
    return this.captureFrameFn !== null
  }
}

export default CaptureService
