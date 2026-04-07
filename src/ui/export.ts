/**
 * Record a canvas animation to WebM using MediaRecorder.
 */
export function startCanvasRecording(
  canvas: HTMLCanvasElement,
  fps: number = 30,
): { stop: () => Promise<Blob> } {
  const stream = canvas.captureStream(fps)
  const chunks: Blob[] = []

  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: 5_000_000,
  })

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }

  recorder.start()

  return {
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }))
        }
        recorder.stop()
      }),
  }
}

/**
 * Trigger a download of a Blob as a file.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
