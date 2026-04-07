export type AnimationState = {
  frameIndex: number
  playing: boolean
  speed: number
  loop: boolean
  totalFrames: number
}

export type FrameCallback = (frameIndex: number) => void

/**
 * rAF-based animation controller that respects per-frame delays.
 */
export class AnimationLoop {
  private state: AnimationState = {
    frameIndex: 0,
    playing: false,
    speed: 1,
    loop: true,
    totalFrames: 0,
  }

  private delays: number[] = []
  private onFrame: FrameCallback
  private onStateChange: (state: AnimationState) => void
  private rafId: number | null = null
  private lastFrameTime: number = 0
  private accumulated: number = 0

  constructor(
    onFrame: FrameCallback,
    onStateChange: (state: AnimationState) => void,
  ) {
    this.onFrame = onFrame
    this.onStateChange = onStateChange
  }

  load(delays: number[], totalFrames: number) {
    this.stop()
    this.delays = delays
    this.state = {
      ...this.state,
      frameIndex: 0,
      totalFrames,
      playing: false,
    }
    this.notify()
    // Render first frame
    this.onFrame(0)
  }

  play() {
    if (this.state.playing || this.state.totalFrames <= 1) return
    this.state.playing = true
    this.lastFrameTime = performance.now()
    this.accumulated = 0
    this.notify()
    this.tick(this.lastFrameTime)
  }

  pause() {
    this.state.playing = false
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.notify()
  }

  stop() {
    this.pause()
    this.state.frameIndex = 0
    this.notify()
  }

  togglePlay() {
    if (this.state.playing) this.pause()
    else this.play()
  }

  seek(frameIndex: number) {
    this.state.frameIndex = Math.max(0, Math.min(frameIndex, this.state.totalFrames - 1))
    this.onFrame(this.state.frameIndex)
    this.notify()
  }

  setSpeed(speed: number) {
    this.state.speed = speed
    this.notify()
  }

  setLoop(loop: boolean) {
    this.state.loop = loop
    this.notify()
  }

  getState(): Readonly<AnimationState> {
    return this.state
  }

  destroy() {
    this.stop()
  }

  private tick = (now: number) => {
    if (!this.state.playing) return

    const elapsed = now - this.lastFrameTime
    this.lastFrameTime = now
    this.accumulated += elapsed * this.state.speed

    const frameDelay = this.delays[this.state.frameIndex] || 100

    if (this.accumulated >= frameDelay) {
      this.accumulated -= frameDelay

      // Advance frame
      let next = this.state.frameIndex + 1
      if (next >= this.state.totalFrames) {
        if (this.state.loop) {
          next = 0
        } else {
          this.pause()
          return
        }
      }

      this.state.frameIndex = next
      this.onFrame(next)
      this.notify()
    }

    this.rafId = requestAnimationFrame(this.tick)
  }

  private notify() {
    this.onStateChange({ ...this.state })
  }
}
