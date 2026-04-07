import type { Grid } from '../types.ts'
import type { CropRegion } from './crop.ts'

export type BrightnessGrid = Grid<number>

// Sample brightness from ImageData at a grid resolution.
// Each grid cell averages a rectangular region of source pixels.
// When crop is provided, only samples within that region.
export function sampleBrightness(
  imageData: ImageData,
  cols: number,
  rows: number,
  crop?: CropRegion,
): BrightnessGrid {
  const { data, width: imgWidth } = imageData
  const cx = crop?.x ?? 0
  const cy = crop?.y ?? 0
  const cw = crop?.width ?? imageData.width
  const ch = crop?.height ?? imageData.height
  const cellW = cw / cols
  const cellH = ch / rows
  const grid: number[] = new Array(cols * rows)

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * cellH)
    const y1 = Math.min(Math.floor((row + 1) * cellH), ch)
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * cellW)
      const x1 = Math.min(Math.floor((col + 1) * cellW), cw)

      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        const rowOffset = (cy + y) * imgWidth * 4
        for (let x = x0; x < x1; x++) {
          const i = rowOffset + (cx + x) * 4
          // Luminance: 0.299R + 0.587G + 0.114B
          sum += 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
          count++
        }
      }
      grid[row * cols + col] = count > 0 ? sum / count / 255 : 0
    }
  }

  return { cols, rows, data: grid }
}
