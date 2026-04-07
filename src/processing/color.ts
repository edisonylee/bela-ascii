import type { Grid } from '../types.ts'

export type ColorGrid = Grid<{ r: number; g: number; b: number }>

// Extract average color per grid cell from ImageData
export function sampleColors(
  imageData: ImageData,
  cols: number,
  rows: number,
): ColorGrid {
  const { data, width, height } = imageData
  const cellW = width / cols
  const cellH = height / rows
  const colors: { r: number; g: number; b: number }[] = new Array(cols * rows)

  for (let row = 0; row < rows; row++) {
    const y0 = Math.floor(row * cellH)
    const y1 = Math.min(Math.floor((row + 1) * cellH), height)
    for (let col = 0; col < cols; col++) {
      const x0 = Math.floor(col * cellW)
      const x1 = Math.min(Math.floor((col + 1) * cellW), width)

      let rSum = 0, gSum = 0, bSum = 0
      let count = 0
      for (let y = y0; y < y1; y++) {
        const rowOffset = y * width * 4
        for (let x = x0; x < x1; x++) {
          const i = rowOffset + x * 4
          rSum += data[i]!
          gSum += data[i + 1]!
          bSum += data[i + 2]!
          count++
        }
      }
      if (count > 0) {
        colors[row * cols + col] = {
          r: Math.round(rSum / count),
          g: Math.round(gSum / count),
          b: Math.round(bSum / count),
        }
      } else {
        colors[row * cols + col] = { r: 0, g: 0, b: 0 }
      }
    }
  }

  return { cols, rows, data: colors }
}
