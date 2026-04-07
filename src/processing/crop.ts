export type CropRegion = {
  x: number
  y: number
  width: number
  height: number
}

export type AspectRatio = 'original' | '16:9' | '4:3' | '1:1' | '9:16' | '21:9'

const RATIOS: Record<Exclude<AspectRatio, 'original'>, number> = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
  '21:9': 21 / 9,
}

export function computeCropRegion(
  sourceWidth: number,
  sourceHeight: number,
  aspect: AspectRatio,
): CropRegion {
  if (aspect === 'original') {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight }
  }

  const target = RATIOS[aspect]
  const sourceRatio = sourceWidth / sourceHeight

  if (sourceRatio > target) {
    // Source is wider — crop width
    const w = Math.round(sourceHeight * target)
    return { x: Math.round((sourceWidth - w) / 2), y: 0, width: w, height: sourceHeight }
  } else {
    // Source is taller — crop height
    const h = Math.round(sourceWidth / target)
    return { x: 0, y: Math.round((sourceHeight - h) / 2), width: sourceWidth, height: h }
  }
}
