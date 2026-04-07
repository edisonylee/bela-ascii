import { parseGIF, decompressFrames } from 'gifuct-js'

export type GifResult = {
  frames: ImageData[]
  delays: number[]
  width: number
  height: number
}

/**
 * Decode a GIF file into composited frames.
 * Each frame is a full-size ImageData with all prior frames composited
 * according to GIF disposal methods.
 */
export async function decodeGif(
  buffer: ArrayBuffer,
  onProgress?: (done: number, total: number) => void,
): Promise<GifResult> {
  const gif = parseGIF(buffer)
  const rawFrames = decompressFrames(gif, true)

  const width = gif.lsd.width
  const height = gif.lsd.height

  // Compositing canvas — maintains state across frames
  const compCanvas = document.createElement('canvas')
  compCanvas.width = width
  compCanvas.height = height
  const compCtx = compCanvas.getContext('2d', { willReadFrequently: true })!

  // Backup canvas for disposal type 3 (restore to previous)
  const backupCanvas = document.createElement('canvas')
  backupCanvas.width = width
  backupCanvas.height = height
  const backupCtx = backupCanvas.getContext('2d')!

  const frames: ImageData[] = []
  const delays: number[] = []

  for (let i = 0; i < rawFrames.length; i++) {
    const frame = rawFrames[i]!
    const { dims, patch, delay, disposalType } = frame

    // Save state before drawing for disposal type 3
    if (disposalType === 3) {
      backupCtx.clearRect(0, 0, width, height)
      backupCtx.drawImage(compCanvas, 0, 0)
    }

    // Draw this frame's patch onto the compositing canvas
    const frameImageData = new ImageData(
      new Uint8ClampedArray(patch),
      dims.width,
      dims.height,
    )
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = dims.width
    tempCanvas.height = dims.height
    const tempCtx = tempCanvas.getContext('2d')!
    tempCtx.putImageData(frameImageData, 0, 0)
    compCtx.drawImage(tempCanvas, dims.left, dims.top)

    // Capture the composited result
    frames.push(compCtx.getImageData(0, 0, width, height))
    delays.push(delay || 100) // default 100ms if unspecified

    // Apply disposal
    if (disposalType === 2) {
      // Restore to background: clear the frame area
      compCtx.clearRect(dims.left, dims.top, dims.width, dims.height)
    } else if (disposalType === 3) {
      // Restore to previous
      compCtx.clearRect(0, 0, width, height)
      compCtx.drawImage(backupCanvas, 0, 0)
    }
    // disposalType 0 or 1: leave as-is

    onProgress?.(i + 1, rawFrames.length)
  }

  return { frames, delays, width, height }
}
