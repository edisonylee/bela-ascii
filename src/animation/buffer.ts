import type { StyledChar, Grid } from '../types.ts'
import type { Palette } from '../processing/palette.ts'
import { sampleBrightness } from '../processing/sampler.ts'
import { sampleColors } from '../processing/color.ts'
import { findBestChar } from '../processing/mapper.ts'

export type ProcessedFrame = Grid<StyledChar>

/**
 * Pre-processes source frames into styled character grids.
 * Can process all frames upfront or lazily.
 */
export class FrameBuffer {
  private frames: (ProcessedFrame | null)[]
  private sourceFrames: ImageData[]
  private palette: Palette
  private cols: number
  private rows: number
  private targetCellWidth: number

  constructor(
    sourceFrames: ImageData[],
    palette: Palette,
    cols: number,
    rows: number,
    targetCellWidth: number,
  ) {
    this.sourceFrames = sourceFrames
    this.palette = palette
    this.cols = cols
    this.rows = rows
    this.targetCellWidth = targetCellWidth
    this.frames = new Array(sourceFrames.length).fill(null)
  }

  /**
   * Process a single frame, caching the result.
   */
  processFrame(index: number): ProcessedFrame {
    const cached = this.frames[index]
    if (cached) return cached

    const imageData = this.sourceFrames[index]!
    const brightness = sampleBrightness(imageData, this.cols, this.rows)
    const colors = sampleColors(imageData, this.cols, this.rows)

    const data: StyledChar[] = new Array(this.cols * this.rows)
    for (let row = 0; row < this.rows; row++) {
      let lastChar: string | null = null
      for (let col = 0; col < this.cols; col++) {
        const i = row * this.cols + col
        const b = brightness.data[i]!
        const c = colors.data[i]!
        const entry = findBestChar(this.palette, b, this.targetCellWidth, lastChar)
        data[i] = { entry, r: c.r, g: c.g, b: c.b }
        lastChar = entry.char
      }
    }

    const grid: ProcessedFrame = { cols: this.cols, rows: this.rows, data }
    this.frames[index] = grid
    return grid
  }

  /**
   * Pre-process all frames. Calls onProgress after each frame.
   */
  processAll(onProgress?: (done: number, total: number) => void): void {
    for (let i = 0; i < this.sourceFrames.length; i++) {
      this.processFrame(i)
      onProgress?.(i + 1, this.sourceFrames.length)
    }
  }

  getFrame(index: number): ProcessedFrame {
    return this.processFrame(index)
  }

  get totalFrames(): number {
    return this.sourceFrames.length
  }

  /**
   * Clear cached processed frames (e.g., when grid dimensions change).
   */
  invalidate() {
    this.frames.fill(null)
  }

  updateGrid(cols: number, rows: number, targetCellWidth: number) {
    this.cols = cols
    this.rows = rows
    this.targetCellWidth = targetCellWidth
    this.invalidate()
  }
}
