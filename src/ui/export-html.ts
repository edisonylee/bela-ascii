import type { StyledChar, Grid } from '../types.ts'
import type { RenderOptions } from '../render/canvas.ts'

const PRESETS: Record<string, (b: number) => { r: number; g: number; b: number }> = {
  matrix: (b) => ({ r: Math.round(b * 40), g: Math.round(30 + b * 225), b: Math.round(b * 60) }),
  amber: (b) => ({ r: Math.round(40 + b * 215), g: Math.round(20 + b * 160), b: Math.round(b * 30) }),
  neon: (b) => {
    if (b < 0.33) return { r: Math.round(100 + b * 3 * 155), g: Math.round(b * 3 * 80), b: Math.round(150 + b * 3 * 105) }
    if (b < 0.66) { const t = (b - 0.33) * 3; return { r: Math.round(255 * (1 - t)), g: Math.round(80 + t * 175), b: Math.round(255) } }
    const t = (b - 0.66) * 3; return { r: Math.round(t * 255), g: Math.round(255), b: Math.round(255 * (1 - t)) }
  },
  ice: (b) => ({ r: Math.round(b * 180), g: Math.round(60 + b * 195), b: Math.round(120 + b * 135) }),
}

function cellColor(cell: StyledChar, opts: Partial<RenderOptions>): string {
  const b = cell.entry.brightness
  const mode = opts.colorMode || 'source'
  switch (mode) {
    case 'source':
      return `rgb(${Math.max(30, cell.r)},${Math.max(30, cell.g)},${Math.max(30, cell.b)})`
    case 'tint': {
      const t = opts.tintColor || { r: 255, g: 102, b: 68 }
      return `rgb(${Math.round(t.r * b)},${Math.round(t.g * b)},${Math.round(t.b * b)})`
    }
    case 'mono':
      return `rgba(255,255,255,${Math.max(0.08, Math.min(1, b)).toFixed(2)})`
    default: {
      const ramp = PRESETS[mode]
      if (ramp) { const c = ramp(b); return `rgb(${c.r},${c.g},${c.b})` }
      return `rgba(255,255,255,${b.toFixed(2)})`
    }
  }
}

function esc(ch: string): string {
  if (ch === '&') return '&amp;'
  if (ch === '<') return '&lt;'
  if (ch === '>') return '&gt;'
  return ch
}

/**
 * Build class map across one or more grids so all frames share the same CSS classes.
 */
function buildStyleClasses(
  grids: Grid<StyledChar>[],
  opts: Partial<RenderOptions>,
): { classMap: Map<string, string>; css: string } {
  const classMap = new Map<string, string>()
  let idx = 0

  for (const grid of grids) {
    for (let i = 0; i < grid.data.length; i++) {
      const cell = grid.data[i]
      if (!cell || cell.entry.brightness < 0.02) continue
      const key = `${cell.entry.font}|${cellColor(cell, opts)}`
      if (!classMap.has(key)) classMap.set(key, `s${idx++}`)
    }
  }

  let css = ''
  for (const [key, cls] of classMap) {
    const [font, color] = key.split('|')
    css += `.${cls}{font:${font};color:${color}}\n`
  }

  return { classMap, css }
}

function renderGrid(
  grid: Grid<StyledChar>,
  opts: Partial<RenderOptions>,
  classMap: Map<string, string>,
): string {
  let rows = ''
  for (let row = 0; row < grid.rows; row++) {
    let spans = ''
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.data[row * grid.cols + col]
      if (!cell || cell.entry.brightness < 0.02) {
        spans += `<span class="e">&nbsp;</span>`
        continue
      }
      const key = `${cell.entry.font}|${cellColor(cell, opts)}`
      const cls = classMap.get(key)!
      spans += `<span class="${cls}">${esc(cell.entry.char)}</span>`
    }
    rows += `<div class="r">${spans}</div>\n`
  }
  return rows
}

/**
 * Export a single frame as a self-contained HTML file.
 */
export function exportToHtml(
  grid: Grid<StyledChar>,
  opts: Partial<RenderOptions> = {},
): string {
  const bg = opts.bgColor || '#201d1d'
  const cellH = (18 * (opts.lineHeight || 1.3))
  const cellW = cellH * 0.6
  const { classMap, css } = buildStyleClasses([grid], opts)
  const rows = renderGrid(grid, opts, classMap)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>bela-ascii</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bg};display:flex;justify-content:center;align-items:start;min-height:100vh;padding:24px}
.art{line-height:1}
.r{display:flex;height:${cellH.toFixed(1)}px;align-items:center}
.r span{display:inline-block;width:${cellW.toFixed(1)}px;text-align:center;flex-shrink:0}
.e{visibility:hidden}
${css}</style>
</head>
<body>
<div class="art">
${rows}</div>
</body>
</html>`
}

/**
 * Export multiple frames as an animated self-contained HTML file.
 * Includes a tiny JS runtime that cycles through frames.
 */
export function exportToAnimatedHtml(
  grids: Grid<StyledChar>[],
  delays: number[],
  opts: Partial<RenderOptions> = {},
): string {
  const bg = opts.bgColor || '#201d1d'
  const cellH = (18 * (opts.lineHeight || 1.3))
  const cellW = cellH * 0.6
  const { classMap, css } = buildStyleClasses(grids, opts)

  // Pre-render each frame's HTML
  const frameHtmls = grids.map(g => renderGrid(g, opts, classMap))

  // Escape for embedding in JS string array
  const framesJson = JSON.stringify(frameHtmls)
  const delaysJson = JSON.stringify(delays)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>bela-ascii</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bg};display:flex;justify-content:center;align-items:start;min-height:100vh;padding:24px}
.art{line-height:1}
.r{display:flex;height:${cellH.toFixed(1)}px;align-items:center}
.r span{display:inline-block;width:${cellW.toFixed(1)}px;text-align:center;flex-shrink:0}
.e{visibility:hidden}
${css}</style>
</head>
<body>
<div class="art" id="art"></div>
<script>
var frames=${framesJson};
var delays=${delaysJson};
var el=document.getElementById("art");
var i=0;
function tick(){
  el.innerHTML=frames[i];
  var d=delays[i]||100;
  i=(i+1)%frames.length;
  setTimeout(tick,d);
}
tick();
</script>
</body>
</html>`
}
