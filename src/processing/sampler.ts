import type { Grid } from '../types.ts'

export type BrightnessGrid = Grid<number>

// Sample brightness from ImageData at a grid resolution.
// Each grid cell averages a rectangular region of source pixels.
export function sampleBrightness(
  imageData: ImageData,
  cols: number,
  rows: number,
): BrightnessGrid {
  const { data, width, height } = imageData
  const cellW = width / cols
  const cellH = height / rows
  const grid: number[] = new Array(cols * rows)

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * cellH)
    const y1 = Math.min(Math.floor((row + 1) * cellH), height)
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * cellW)
      const x1 = Math.min(Math.floor((col + 1) * cellW), width)

      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        const rowOffset = y * width * 4
        for (let x = x0; x < x1; x++) {
          const i = rowOffset + x * 4
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
