export type CameraFeed = {
  stop: () => void
  getFrame: () => ImageData
  width: number
  height: number
}

/**
 * Start a live camera feed. Returns a handle to grab frames and stop.
 */
export async function startCamera(): Promise<CameraFeed> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: false,
  })

  const video = document.createElement('video')
  video.srcObject = stream
  video.playsInline = true
  video.muted = true
  await video.play()

  const width = video.videoWidth
  const height = video.videoHeight

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  function getFrame(): ImageData {
    ctx.drawImage(video, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  }

  function stop() {
    stream.getTracks().forEach(t => t.stop())
    video.srcObject = null
  }

  return { stop, getFrame, width, height }
}
