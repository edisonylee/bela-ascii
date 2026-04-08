import type { PaletteEntry } from '../types.ts'
import type { Palette, SizeTier } from './palette.ts'

function pickTier(palette: Palette, brightness: number): SizeTier {
  const tiers = palette.tiers
  if (brightness < 0.35) return tiers[0]!
  if (brightness < 0.65) return tiers[1]!
  return tiers[2]!
}

function findInTier(
  tier: SizeTier,
  targetBrightness: number,
  targetCellWidth: number,
  lastChar: string | null,
): PaletteEntry {
  const sorted = tier.sorted
  if (sorted.length === 0) throw new Error('Empty tier')

  let lo = 0
  let hi = sorted.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid]!.brightness < targetBrightness) lo = mid + 1
    else hi = mid
  }

  let bestScore = Infinity
  let best = sorted[lo]!
  const start = Math.max(0, lo - 20)
  const end = Math.min(sorted.length, lo + 20)

  for (let i = start; i < end; i++) {
    const entry = sorted[i]!
    const brightnessError = Math.abs(entry.brightness - targetBrightness) * 2.5
    const widthError = Math.abs(entry.width - targetCellWidth) / targetCellWidth
    const repetitionPenalty = (lastChar !== null && entry.char === lastChar) ? 0.15 : 0
    const score = brightnessError + widthError + repetitionPenalty
    if (score < bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best
}

export function findBestChar(
  palette: Palette,
  targetBrightness: number,
  targetCellWidth: number,
  lastChar?: string | null,
): PaletteEntry {
  if (targetBrightness < 0.03) {
    return palette.tiers[0]!.sorted[0]!
  }

  const tier = pickTier(palette, targetBrightness)
  return findInTier(tier, targetBrightness, targetCellWidth, lastChar ?? null)
}
