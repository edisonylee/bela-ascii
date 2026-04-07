/**
 * Pre-renders character+font combos to OffscreenCanvas bitmaps.
 * Using drawImage with cached bitmaps is 5-10x faster than fillText during animation.
 */
export class BitmapCache {
  private cache = new Map<string, ImageBitmap>()
  private pending = new Map<string, Promise<ImageBitmap>>()
  private maxSize: number

  constructor(maxSize: number = 2000) {
    this.maxSize = maxSize
  }

  private makeKey(char: string, font: string, color: string): string {
    return `${char}\0${font}\0${color}`
  }

  /**
   * Get a cached bitmap, or null if not yet cached.
   * Call warm() to pre-populate.
   */
  get(char: string, font: string, color: string): ImageBitmap | null {
    return this.cache.get(this.makeKey(char, font, color)) ?? null
  }

  /**
   * Pre-render a set of character+font+color combos.
   */
  async warm(
    entries: Array<{ char: string; font: string; color: string; height: number }>,
  ): Promise<void> {
    const toRender: typeof entries = []

    for (const e of entries) {
      const key = this.makeKey(e.char, e.font, e.color)
      if (!this.cache.has(key) && !this.pending.has(key)) {
        toRender.push(e)
      }
    }

    if (toRender.length === 0) return

    // Evict oldest if we'd exceed max
    if (this.cache.size + toRender.length > this.maxSize) {
      const toEvict = this.cache.size + toRender.length - this.maxSize
      const keys = this.cache.keys()
      for (let i = 0; i < toEvict; i++) {
        const next = keys.next()
        if (next.done) break
        this.cache.get(next.value)?.close()
        this.cache.delete(next.value)
      }
    }

    // Render in batch using a single OffscreenCanvas
    const canvas = new OffscreenCanvas(1, 1)
    const ctx = canvas.getContext('2d')!

    for (const e of toRender) {
      const key = this.makeKey(e.char, e.font, e.color)

      // Size canvas to fit the character
      ctx.font = e.font
      const metrics = ctx.measureText(e.char)
      const w = Math.ceil(metrics.width) + 4
      const h = e.height + 4
      canvas.width = w
      canvas.height = h

      ctx.font = e.font
      ctx.textBaseline = 'middle'
      ctx.fillStyle = e.color
      ctx.fillText(e.char, 2, h / 2)

      const bitmap = await createImageBitmap(canvas)
      this.cache.set(key, bitmap)
    }
  }

  clear() {
    for (const bmp of this.cache.values()) bmp.close()
    this.cache.clear()
    this.pending.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
