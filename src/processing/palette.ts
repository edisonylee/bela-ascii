import { prepareWithSegments } from '@chenglou/pretext'
import type { PaletteEntry, FontStyleVariant } from '../types.ts'

const CHARSET = ' .,:;!+-=*#@%&abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const WEIGHTS = [300, 500, 800] as const
const STYLES: FontStyleVariant[] = ['normal', 'italic']
const PROP_FAMILY = 'Georgia, Palatino, "Times New Roman", serif'

const BRIGHTNESS_CANVAS_SIZE = 28

let brightnessCanvas: HTMLCanvasElement | null = null
let brightnessCtx: CanvasRenderingContext2D | null = null

function getBrightnessCtx(): CanvasRenderingContext2D {
  if (!brightnessCtx) {
    brightnessCanvas = document.createElement('canvas')
    brightnessCanvas.width = BRIGHTNESS_CANVAS_SIZE
    brightnessCanvas.height = BRIGHTNESS_CANVAS_SIZE
    brightnessCtx = brightnessCanvas.getContext('2d', { willReadFrequently: true })!
  }
  return brightnessCtx
}

function estimateBrightness(ch: string, font: string): number {
  const size = BRIGHTNESS_CANVAS_SIZE
  const ctx = getBrightnessCtx()
  ctx.clearRect(0, 0, size, size)
  ctx.font = font
  ctx.fillStyle = '#fff'
  ctx.textBaseline = 'middle'
  ctx.fillText(ch, 1, size / 2)
  const data = ctx.getImageData(0, 0, size, size).data
  let sum = 0
  for (let i = 3; i < data.length; i += 4) sum += data[i]!
  return sum / (255 * size * size)
}

function measureWidth(ch: string, font: string): number {
  const prepared = prepareWithSegments(ch, font)
  return prepared.widths.length > 0 ? prepared.widths[0]! : 0
}

export function buildFontString(size: number, weight: number, style: FontStyleVariant): string {
  return `${style === 'italic' ? 'italic ' : ''}${weight} ${size}px ${PROP_FAMILY}`
}

// A size tier contains entries for one font size, with brightness normalized within the tier
export type SizeTier = {
  fontSize: number
  sorted: PaletteEntry[] // sorted by brightness (0-1 normalized within tier)
  avgWidth: number
}

export type Palette = {
  tiers: SizeTier[] // ordered small → large (10, 14, 18)
}

export const FONT_SIZES = [10, 14, 18] as const

export function buildPalette(): Palette {
  const tiers: SizeTier[] = []

  for (const fontSize of FONT_SIZES) {
    const entries: PaletteEntry[] = []

    for (const style of STYLES) {
      for (const weight of WEIGHTS) {
        const font = buildFontString(fontSize, weight, style)
        for (const ch of CHARSET) {
          if (ch === ' ') continue
          const width = measureWidth(ch, font)
          if (width <= 0) continue
          const brightness = estimateBrightness(ch, font)
          entries.push({ char: ch, weight, style, font, width, brightness })
        }
      }
    }

    // Normalize brightness within this tier to 0-1
    const maxB = Math.max(...entries.map(e => e.brightness))
    if (maxB > 0) {
      for (const entry of entries) {
        entry.brightness /= maxB
      }
    }

    entries.sort((a, b) => a.brightness - b.brightness)

    const avgWidth = entries.reduce((s, e) => s + e.width, 0) / entries.length

    tiers.push({ fontSize, sorted: entries, avgWidth })
  }

  return { tiers }
}
