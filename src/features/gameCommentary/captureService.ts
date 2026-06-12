export type CaptureFrameFn = (
  maxWidth?: number,
  quality?: number
) => string | null

/**
 * CaptureService - Screen capture API service (Singleton)
 *
 * Provides a registration-based API for capturing frames from
 * the screen share video element without storing DOM refs in stores.
 */
class CaptureService {
  private static instance: CaptureService
  private captureFrameFn: CaptureFrameFn | null = null

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
  registerCaptureFunction(fn: CaptureFrameFn | null): void {
    this.captureFrameFn = fn
  }

  /**
   * Capture the current frame, optionally resizing and compressing
   * @param maxWidth - Maximum width to resize to (0 or undefined = no resize)
   * @param quality - JPEG quality (0.0-1.0)
   * @returns Base64 data URL string or null if unavailable
   */
  captureFrame(maxWidth?: number, quality?: number): string | null {
    return this.captureFrameFn?.(maxWidth, quality) ?? null
  }

  /**
   * Check if a capture function is registered and available
   */
  isAvailable(): boolean {
    return this.captureFrameFn !== null
  }
}

export default CaptureService
