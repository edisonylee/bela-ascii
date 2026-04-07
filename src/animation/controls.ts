import type { AnimationLoop, AnimationState } from './loop.ts'

/**
 * Creates and manages playback control UI elements.
 * Styled via #playback-controls rules in index.html.
 */
export function createControls(
  container: HTMLElement,
  loop: AnimationLoop,
): { update: (state: AnimationState) => void; destroy: () => void } {
  const wrapper = document.createElement('div')
  wrapper.id = 'playback-controls'

  // Play/Pause
  const playBtn = document.createElement('button')
  playBtn.textContent = '\u25B6'
  playBtn.title = 'play / pause'
  playBtn.onclick = () => loop.togglePlay()

  // Seek
  const seekSlider = document.createElement('input')
  seekSlider.type = 'range'
  seekSlider.min = '0'
  seekSlider.max = '0'
  seekSlider.value = '0'
  seekSlider.oninput = () => loop.seek(parseInt(seekSlider.value))

  // Frame counter
  const frameLabel = document.createElement('span')
  frameLabel.className = 'frame-label'

  // Speed
  const speedLabel = document.createElement('label')
  speedLabel.textContent = 'speed '
  const speedSelect = document.createElement('select')
  for (const s of [0.25, 0.5, 1, 1.5, 2]) {
    const opt = document.createElement('option')
    opt.value = String(s)
    opt.textContent = `${s}x`
    if (s === 1) opt.selected = true
    speedSelect.appendChild(opt)
  }
  speedSelect.onchange = () => loop.setSpeed(parseFloat(speedSelect.value))
  speedLabel.appendChild(speedSelect)

  // Loop
  const loopLabel = document.createElement('label')
  loopLabel.textContent = 'loop '
  const loopCheck = document.createElement('input')
  loopCheck.type = 'checkbox'
  loopCheck.checked = true
  loopCheck.onchange = () => loop.setLoop(loopCheck.checked)
  loopLabel.appendChild(loopCheck)

  wrapper.append(playBtn, seekSlider, frameLabel, speedLabel, loopLabel)
  container.appendChild(wrapper)

  function update(state: AnimationState) {
    playBtn.textContent = state.playing ? '\u23F8' : '\u25B6'
    seekSlider.max = String(Math.max(0, state.totalFrames - 1))
    seekSlider.value = String(state.frameIndex)
    frameLabel.textContent = `${state.frameIndex + 1}/${state.totalFrames}`
  }

  function destroy() {
    wrapper.remove()
  }

  return { update, destroy }
}
