export type VideoResult = {
  frames: ImageData[]
  delays: number[]
  width: number
  height: number
}

/**
 * Extract frames from a video file using <video> + canvas drawImage.
 * Seeks through the video at the target FPS and captures each frame.
 */
export async function decodeVideo(
  file: File,
  targetFps: number = 15,
  onProgress?: (done: number, total: number) => void,
): Promise<VideoResult> {
  const url = URL.createObjectURL(file)

  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url

    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video'))
    })

    const width = video.videoWidth
    const height = video.videoHeight
    const duration = video.duration

    if (!isFinite(duration) || duration <= 0) {
      throw new Error('Cannot determine video duration')
    }

    const frameInterval = 1 / targetFps
    const totalFrames = Math.floor(duration * targetFps)
    const delay = Math.round(frameInterval * 1000) // ms per frame

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!

    const frames: ImageData[] = []
    const delays: number[] = []

    for (let i = 0; i < totalFrames; i++) {
      const time = i * frameInterval

      // Seek to time
      video.currentTime = time
      await new Promise<void>((resolve) => {
        video.onseeked = () => resolve()
      })

      // Draw frame to canvas and extract
      ctx.drawImage(video, 0, 0, width, height)
      frames.push(ctx.getImageData(0, 0, width, height))
      delays.push(delay)

      onProgress?.(i + 1, totalFrames)
    }

    return { frames, delays, width, height }
  } finally {
    URL.revokeObjectURL(url)
  }
}
