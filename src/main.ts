import { buildPalette, type Palette } from './processing/palette.ts'
import { computeCropRegion, type AspectRatio } from './processing/crop.ts'
import { sampleBrightness } from './processing/sampler.ts'
import { sampleColors } from './processing/color.ts'
import { findBestChar } from './processing/mapper.ts'
import { renderToCanvas, type ColorMode } from './render/canvas.ts'
import type { StyledChar } from './types.ts'
import { loadFrameSource, type FrameSource } from './input/frame-source.ts'
import { FrameBuffer } from './animation/buffer.ts'
import { AnimationLoop } from './animation/loop.ts'
import { createControls } from './animation/controls.ts'
import { startCanvasRecording, downloadBlob } from './ui/export.ts'
import { exportToHtml, exportToAnimatedHtml } from './ui/export-html.ts'
import { startCamera, type CameraFeed } from './input/camera.ts'

// --- DOM ---
const fileInput = document.getElementById('file-input') as HTMLInputElement
const uploadZone = document.getElementById('upload-zone') as HTMLElement
const densitySlider = document.getElementById('density') as HTMLInputElement
const colorModeSelect = document.getElementById('color-mode') as HTMLSelectElement
const tintColorInput = document.getElementById('tint-color') as HTMLInputElement
const outputCanvas = document.getElementById('output-canvas') as HTMLCanvasElement
const sourcePreview = document.getElementById('source-preview') as HTMLCanvasElement
const previewWrap = document.getElementById('preview-wrap') as HTMLElement
const controlsContainer = document.getElementById('controls') as HTMLElement
const statusEl = document.getElementById('status') as HTMLElement
const emptyState = document.getElementById('empty-state') as HTMLElement
const aspectSelect = document.getElementById('aspect-ratio') as HTMLSelectElement
const speedGroup = document.getElementById('speed-group') as HTMLElement
const speedSelect = document.getElementById('speed-select') as HTMLSelectElement
const cameraBtn = document.getElementById('camera-btn') as HTMLButtonElement
const downloadBar = document.getElementById('download-bar') as HTMLElement
const downloadHtmlBtn = document.getElementById('download-html') as HTMLButtonElement
const downloadPngBtn = document.getElementById('download-png') as HTMLButtonElement
const downloadWebmBtn = document.getElementById('download-webm') as HTMLButtonElement

function setStatus(msg: string, ready = false) {
  if (statusEl) {
    statusEl.textContent = msg
    statusEl.classList.toggle('ready', ready)
  }
}

// --- State ---
let palette: Palette | null = null
let frameSource: FrameSource | null = null
let frameBuffer: FrameBuffer | null = null
let currentAspect: AspectRatio = 'original'

// Build palette on load
setStatus('building character palette...')
try {
  palette = buildPalette()
  setStatus(`palette ready — ${palette.tiers.map(t => `${t.fontSize}px: ${t.sorted.length}`).join(', ')}`, true)
} catch (err) {
  console.error('Palette build failed:', err)
  setStatus(`error building palette: ${(err as Error).message}`)
}

// Target output width for the ASCII art
const TARGET_OUTPUT_WIDTH = 600

function parseTintHex(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.slice(1), 16)
  return { r: (v >> 16) & 0xff, g: (v >> 8) & 0xff, b: v & 0xff }
}

function getRenderOpts() {
  return {
    colorMode: colorModeSelect.value as ColorMode,
    tintColor: parseTintHex(tintColorInput.value),
  }
}

const CELL_ASPECT = 0.6

function getGridDimensions(width: number, height: number): { cols: number; rows: number } {
  const density = parseInt(densitySlider.value)
  const cols = Math.floor(width / (density * CELL_ASPECT))
  const rows = Math.floor(height / density)
  return { cols, rows }
}

// --- Animation ---
const animLoop = new AnimationLoop(
  (frameIndex) => {
    if (!frameBuffer) return
    const grid = frameBuffer.getFrame(frameIndex)
    renderToCanvas(outputCanvas, grid, getRenderOpts())
  },
  (_state) => {
    controlsUI?.update(_state)
  },
)

let controlsUI: ReturnType<typeof createControls> | null = null

function renderSingleFrame() {
  if (!frameBuffer) return
  const state = animLoop.getState()
  const grid = frameBuffer.getFrame(state.frameIndex)
  renderToCanvas(outputCanvas, grid, getRenderOpts())
}

function rebuildGrid() {
  if (!frameSource || !palette) return
  const crop = computeCropRegion(frameSource.width, frameSource.height, currentAspect)
  const { cols, rows } = getGridDimensions(crop.width, crop.height)
  if (cols === 0 || rows === 0) return
  const targetCellWidth = TARGET_OUTPUT_WIDTH / cols
  frameBuffer?.updateGrid(cols, rows, targetCellWidth, crop)
  renderSingleFrame()
}

function setupFrameSource(source: FrameSource) {
  frameSource = source

  // Hide empty state, show preview
  emptyState.style.display = 'none'
  previewWrap.style.display = ''

  // Show source preview
  const previewCtx = sourcePreview.getContext('2d')!
  const scale = Math.min(160 / source.width, 160 / source.height, 1)
  sourcePreview.width = source.width * scale
  sourcePreview.height = source.height * scale
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = source.width
  tempCanvas.height = source.height
  const tempCtx = tempCanvas.getContext('2d')!
  tempCtx.putImageData(source.frames[0]!, 0, 0)
  previewCtx.drawImage(tempCanvas, 0, 0, sourcePreview.width, sourcePreview.height)

  const crop = computeCropRegion(source.width, source.height, currentAspect)
  const { cols, rows } = getGridDimensions(crop.width, crop.height)
  if (cols === 0 || rows === 0) return

  const targetCellWidth = TARGET_OUTPUT_WIDTH / cols

  frameBuffer = new FrameBuffer(source.frames, palette!, cols, rows, targetCellWidth, crop)

  if (source.frames.length > 1) {
    setStatus(`processing ${source.frames.length} frames...`)
    frameBuffer.processFrame(0)
    renderToCanvas(outputCanvas, frameBuffer.getFrame(0), getRenderOpts())

    let processed = 1
    function processBatch() {
      const batchEnd = Math.min(processed + 5, source.frames.length)
      for (let i = processed; i < batchEnd; i++) {
        frameBuffer!.processFrame(i)
      }
      processed = batchEnd
      setStatus(`processing frames: ${processed}/${source.frames.length}`)

      if (processed < source.frames.length) {
        setTimeout(processBatch, 0)
      } else {
        setStatus(`ready — ${source.frames.length} frames`, true)
        animLoop.load(source.delays, source.frames.length)
        animLoop.play()
      }
    }
    setTimeout(processBatch, 0)
  } else {
    setStatus('ready', true)
    animLoop.load(source.delays, 1)
  }

  if (controlsUI) controlsUI.destroy()
  if (source.frames.length > 1) {
    controlsUI = createControls(controlsContainer, animLoop)
    speedGroup.style.display = ''
  } else {
    speedGroup.style.display = 'none'
  }

  downloadBar.style.display = 'flex'
}

// --- File loading ---
async function loadFile(file: File) {
  stopCamera()
  animLoop.stop()
  setStatus(`loading ${file.name}...`)

  try {
    const source = await loadFrameSource(file, (done, total) => {
      setStatus(`extracting frames: ${done}/${total}`)
    })
    setupFrameSource(source)
  } catch (err) {
    setStatus(`error: ${(err as Error).message}`)
    console.error(err)
  }
}

// --- Events ---
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  if (file) loadFile(file)
})

// Drag and drop
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault()
  uploadZone.classList.add('dragover')
})
uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('dragover')
})
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault()
  uploadZone.classList.remove('dragover')
  const file = e.dataTransfer?.files[0]
  if (file) loadFile(file)
})

densitySlider.addEventListener('input', rebuildGrid)

aspectSelect.addEventListener('change', () => {
  currentAspect = aspectSelect.value as AspectRatio
  rebuildGrid()
})

colorModeSelect.addEventListener('change', () => {
  tintColorInput.style.display = colorModeSelect.value === 'tint' ? '' : 'none'
  renderSingleFrame()
})

tintColorInput.addEventListener('input', () => {
  renderSingleFrame()
})

speedSelect.addEventListener('change', () => {
  animLoop.setSpeed(parseFloat(speedSelect.value))
})

// Download HTML — self-contained file with real text spans (animated if multi-frame)
downloadHtmlBtn.addEventListener('click', () => {
  if (!frameBuffer || !frameSource) return

  downloadHtmlBtn.disabled = true
  downloadHtmlBtn.textContent = 'building...'

  const opts = getRenderOpts()
  let html: string

  if (frameSource.frames.length > 1) {
    // Animated: include all frames with JS player
    const grids = []
    for (let i = 0; i < frameSource.frames.length; i++) {
      grids.push(frameBuffer.getFrame(i))
    }
    html = exportToAnimatedHtml(grids, frameSource.delays, opts)
  } else {
    // Static: single frame
    const grid = frameBuffer.getFrame(0)
    html = exportToHtml(grid, opts)
  }

  const blob = new Blob([html], { type: 'text/html' })
  downloadBlob(blob, 'bela-ascii.html')

  downloadHtmlBtn.disabled = false
  downloadHtmlBtn.textContent = 'download code'
})

// Download PNG — rasterized canvas
downloadPngBtn.addEventListener('click', () => {
  outputCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, 'bela-ascii.png')
  }, 'image/png')
})

// Download WebM — record one full animation loop
downloadWebmBtn.addEventListener('click', async () => {
  if (!frameSource || !frameBuffer) return

  downloadWebmBtn.disabled = true
  downloadWebmBtn.textContent = 'recording...'

  const wasPlaying = animLoop.getState().playing
  if (wasPlaying) animLoop.pause()

  animLoop.seek(0)
  const recording = startCanvasRecording(outputCanvas, 30)

  const delays = frameSource.delays
  for (let i = 0; i < frameSource.frames.length; i++) {
    const grid = frameBuffer.getFrame(i)
    renderToCanvas(outputCanvas, grid, getRenderOpts())
    await new Promise(r => setTimeout(r, delays[i] || 100))
  }

  const blob = await recording.stop()
  downloadBlob(blob, 'bela-ascii.webm')

  downloadWebmBtn.disabled = false
  downloadWebmBtn.textContent = 'download video'

  if (wasPlaying) animLoop.play()
})

// --- Camera ---
let cameraFeed: CameraFeed | null = null
let cameraRafId: number | null = null

function stopCamera() {
  if (cameraRafId !== null) {
    cancelAnimationFrame(cameraRafId)
    cameraRafId = null
  }
  if (cameraFeed) {
    cameraFeed.stop()
    cameraFeed = null
  }
  cameraBtn.classList.remove('active')
}

function cameraLoop() {
  if (!cameraFeed || !palette) return

  const imageData = cameraFeed.getFrame()
  const crop = computeCropRegion(cameraFeed.width, cameraFeed.height, currentAspect)
  const { cols, rows } = getGridDimensions(crop.width, crop.height)
  if (cols === 0 || rows === 0) {
    cameraRafId = requestAnimationFrame(cameraLoop)
    return
  }

  const targetCellWidth = TARGET_OUTPUT_WIDTH / cols
  const brightness = sampleBrightness(imageData, cols, rows, crop)
  const colors = sampleColors(imageData, cols, rows, crop)

  const data: StyledChar[] = new Array(cols * rows)
  for (let row = 0; row < rows; row++) {
    let lastChar: string | null = null
    for (let col = 0; col < cols; col++) {
      const i = row * cols + col
      const b = brightness.data[i]!
      const c = colors.data[i]!
      const entry = findBestChar(palette!, b, targetCellWidth, lastChar)
      data[i] = { entry, r: c.r, g: c.g, b: c.b }
      lastChar = entry.char
    }
  }

  renderToCanvas(outputCanvas, { cols, rows, data }, getRenderOpts())
  cameraRafId = requestAnimationFrame(cameraLoop)
}

cameraBtn.addEventListener('click', async () => {
  if (cameraFeed) {
    stopCamera()
    setStatus('camera stopped')
    return
  }

  // Stop any file-based playback
  animLoop.stop()
  if (controlsUI) { controlsUI.destroy(); controlsUI = null }
  speedGroup.style.display = 'none'
  downloadBar.style.display = 'none'

  setStatus('starting camera...')
  try {
    cameraFeed = await startCamera()
    cameraBtn.classList.add('active')
    emptyState.style.display = 'none'
    previewWrap.style.display = 'none'
    setStatus('camera live', true)
    downloadBar.style.display = 'flex'
    cameraLoop()
  } catch (err) {
    setStatus(`camera error: ${(err as Error).message}`)
  }
})

// Hide tint picker initially
tintColorInput.style.display = colorModeSelect.value === 'tint' ? '' : 'none'
