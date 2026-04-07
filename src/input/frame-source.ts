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

/**
 * Load a file as a single-frame image source.
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

    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(img, 0, 0)

    return {
      frames: [ctx.getImageData(0, 0, img.width, img.height)],
      delays: [0],
      width: img.width,
      height: img.height,
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
