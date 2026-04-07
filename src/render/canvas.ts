import type { StyledChar, Grid } from '../types.ts'

export type ColorMode = 'source' | 'tint' | 'mono' | 'matrix' | 'amber' | 'neon' | 'ice'

export type RenderOptions = {
  lineHeight: number
  colorMode: ColorMode
  tintColor: { r: number; g: number; b: number }
  bgColor: string
}

const DEFAULT_OPTIONS: RenderOptions = {
  lineHeight: 1.3,
  colorMode: 'source',
  tintColor: { r: 255, g: 102, b: 68 },
  bgColor: '#201d1d',
}

// Preset color ramps: maps brightness (0-1) to RGB
const PRESETS: Record<string, (brightness: number) => { r: number; g: number; b: number }> = {
  matrix: (b) => ({ r: Math.round(b * 40), g: Math.round(30 + b * 225), b: Math.round(b * 60) }),
  amber: (b) => ({ r: Math.round(40 + b * 215), g: Math.round(20 + b * 160), b: Math.round(b * 30) }),
  neon: (b) => {
    // Cycle through magenta → cyan → yellow based on brightness
    if (b < 0.33) return { r: Math.round(100 + b * 3 * 155), g: Math.round(b * 3 * 80), b: Math.round(150 + b * 3 * 105) }
    if (b < 0.66) { const t = (b - 0.33) * 3; return { r: Math.round(255 * (1 - t)), g: Math.round(80 + t * 175), b: Math.round(255) } }
    const t = (b - 0.66) * 3; return { r: Math.round(t * 255), g: Math.round(255), b: Math.round(255 * (1 - t)) }
  },
  ice: (b) => ({ r: Math.round(b * 180), g: Math.round(60 + b * 195), b: Math.round(120 + b * 135) }),
}

function getCellColor(cell: StyledChar, opts: RenderOptions): string {
  const b = cell.entry.brightness

  switch (opts.colorMode) {
    case 'source': {
      const minCh = 30
      return `rgb(${Math.max(minCh, cell.r)},${Math.max(minCh, cell.g)},${Math.max(minCh, cell.b)})`
    }
    case 'tint': {
      const { r, g, b: tb } = opts.tintColor
      return `rgb(${Math.round(r * b)},${Math.round(g * b)},${Math.round(tb * b)})`
    }
    case 'mono': {
      const alpha = Math.max(0.08, Math.min(1, b))
      return `rgba(255,255,255,${alpha})`
    }
    default: {
      const ramp = PRESETS[opts.colorMode]
      if (ramp) {
        const c = ramp(b)
        return `rgb(${c.r},${c.g},${c.b})`
      }
      return `rgba(255,255,255,${b})`
    }
  }
}

// Render a grid of styled characters to a canvas.
export function renderToCanvas(
  canvas: HTMLCanvasElement,
  grid: Grid<StyledChar>,
  options: Partial<RenderOptions> = {},
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const ctx = canvas.getContext('2d')!

  const maxFontSize = 18
  const cellHeight = maxFontSize * opts.lineHeight
  const cellWidth = cellHeight * 0.6

  const cssWidth = Math.ceil(grid.cols * cellWidth)
  const cssHeight = Math.ceil(grid.rows * cellHeight)

  const dpr = window.devicePixelRatio || 1
  canvas.width = cssWidth * dpr
  canvas.height = cssHeight * dpr
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${cssHeight}px`
  ctx.scale(dpr, dpr)

  // Background
  ctx.fillStyle = opts.bgColor
  ctx.fillRect(0, 0, cssWidth, cssHeight)

  // Render characters
  for (let row = 0; row < grid.rows; row++) {
    const y = row * cellHeight + cellHeight / 2
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.data[row * grid.cols + col]
      if (!cell) continue
      if (cell.entry.brightness < 0.02) continue

      const x = col * cellWidth
      ctx.font = cell.entry.font
      ctx.textBaseline = 'middle'
      ctx.fillStyle = getCellColor(cell, opts)

      const charOffset = (cellWidth - cell.entry.width) / 2
      ctx.fillText(cell.entry.char, x + Math.max(0, charOffset), y)
    }
  }
}
