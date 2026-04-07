import type { PaletteEntry } from '../types.ts'
import type { Palette, SizeTier } from './palette.ts'

// Select which size tier to use based on brightness.
// Dark → small font (detail), bright → large font (impact/depth).
function pickTier(palette: Palette, brightness: number): SizeTier {
  const tiers = palette.tiers
  if (brightness < 0.08) return tiers[0]! // near-black → smallest
  if (brightness < 0.35) return tiers[0]! // dark → 10px
  if (brightness < 0.65) return tiers[1]! // mid → 14px
  return tiers[2]! // bright → 18px
}

// Find best character within a tier using binary search + local scan.
function findInTier(
  tier: SizeTier,
  targetBrightness: number,
  targetCellWidth: number,
  lastChar: string | null,
): PaletteEntry {
  const sorted = tier.sorted
  if (sorted.length === 0) throw new Error('Empty tier')

  // Binary search
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
    // Penalize repeating the same character as the previous cell
    const repetitionPenalty = (lastChar !== null && entry.char === lastChar) ? 0.15 : 0
    const score = brightnessError + widthError + repetitionPenalty
    if (score < bestScore) {
      bestScore = score
      best = entry
    }
  }
  return best
}

// Find the best character for a target brightness.
// Selects size tier by brightness level, then picks best char within that tier.
export function findBestChar(
  palette: Palette,
  targetBrightness: number,
  targetCellWidth: number,
  lastChar?: string | null,
): PaletteEntry {
  // Very dark cells → space
  if (targetBrightness < 0.03) {
    const tier = palette.tiers[0]!
    // Return lightest entry as a "barely there" character
    return tier.sorted[0]!
  }

  const tier = pickTier(palette, targetBrightness)
  return findInTier(tier, targetBrightness, targetCellWidth, lastChar ?? null)
}
