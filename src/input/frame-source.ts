import { decodeGif } from './gif-decoder.ts'
import { decodeVideo } from './video-decoder.ts'

export type FrameSource = {
  frames: ImageData[]
  delays: number[]
  width: number
  height: number
}

function isGif(file: File): boolean {
  return file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif')
}

function isVideo(file: File): boolean {
  return file.type.startsWith('video/')
}

function isImage(file: File): boolean {
  return file.type.startsWith('image/') && !isGif(file)
}

// Mobile canvas limits are strict — cap source dimensions to stay safe.
const MAX_DIMENSION = 2048

/**
 * Load a file as a single-frame image source.
 * Downscales large images to fit within mobile canvas limits.
 */
async function loadImage(file: File): Promise<FrameSource> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to load image'))
    })

    let w = img.width
    let h = img.height

    // Downscale if either dimension exceeds the limit
    if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
      const scale = Math.min(MAX_DIMENSION / w, MAX_DIMENSION / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0, w, h)

    return {
      frames: [ctx.getImageData(0, 0, w, h)],
      delays: [0],
      width: w,
      height: h,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Decode any supported file into a unified FrameSource.
 * Supports: static images, GIFs, and video files.
 */
export async function loadFrameSource(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<FrameSource> {
  if (isGif(file)) {
    const buffer = await file.arrayBuffer()
    return decodeGif(buffer, onProgress)
  }

  if (isVideo(file)) {
    return decodeVideo(file, 15, onProgress)
  }

  if (isImage(file)) {
    return loadImage(file)
  }

  throw new Error(`Unsupported file type: ${file.type}`)
}
