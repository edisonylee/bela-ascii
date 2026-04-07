# bela-ascii

Real-time ASCII art renderer for images, GIFs, and videos. Runs entirely in the browser -- no server, no uploads, no dependencies beyond the browser itself.

**[Live demo](https://bela-ascii.vercel.app)**

## What it does

Drop in an image, GIF, or video and bela-ascii converts it to a grid of styled ASCII characters in real time. Characters are selected by measured brightness -- not from a hardcoded lookup table -- using actual font rendering to compute how "bright" each character appears at various sizes, weights, and styles.

The result is an animated (or static) ASCII art canvas you can interact with:

- **Density slider** -- controls how many characters make up the grid (fewer = larger characters, more = finer detail)
- **Color modes** -- `source` (preserves original colors), `tint` (single color wash), `mono` (grayscale), `matrix` (green terminal), `amber` (warm CRT), `neon` (magenta/cyan/yellow ramp), `ice` (cool blue tones)
- **Playback controls** -- play/pause, seek, speed adjustment, and loop toggle for animated sources (GIFs and videos)

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (or Node.js 18+)

### Install and run

```bash
git clone https://github.com/edisonylee/bela-ascii.git
cd bela-ascii
bun install
bun run dev
```

This starts a Vite dev server at `http://localhost:5173`.

### Build for production

```bash
bun run build
```

Output goes to `dist/`. This is a static site -- serve it from anywhere.

### Type checking

```bash
bun run check
```

Runs `tsc --noEmit` against the codebase.

## How it works

### Pipeline overview

```
Input (image/gif/video)
  --> Frame extraction
    --> Brightness + color sampling per grid cell
      --> Character selection from pre-computed palette
        --> Canvas rendering with color mode applied
```

### 1. Palette generation (`src/processing/palette.ts`)

On startup, bela-ascii builds a character palette by rendering every printable ASCII character across:

- **3 font sizes**: 10px, 14px, 18px
- **3 font weights**: 300 (light), 500 (medium), 800 (bold)
- **2 styles**: normal, italic

Each combination is drawn to a 28x28 offscreen canvas and its brightness is measured from the alpha channel. This produces a sorted lookup of ~1400 entries mapping characters to their visual brightness. Characters are grouped into size tiers so the mapper can pick appropriately-sized glyphs for different brightness ranges.

Uses [`@chenglou/pretext`](https://github.com/chenglou/pretext) for DOM-free text measurement.

### 2. Frame extraction (`src/input/`)

- **Images**: loaded directly via `ImageBitmap`, single frame
- **GIFs**: decoded with [`gifuct-js`](https://github.com/nichibi/gifuct-js) with proper disposal method compositing (handles transparent frames, restore-to-background, restore-to-previous)
- **Videos**: frames extracted at 15 FPS by seeking through the video element and capturing to canvas

### 3. Sampling (`src/processing/`)

Each frame is divided into a grid. For every cell:

- **Brightness** (`sampler.ts`): perceived luminance via `0.299R + 0.587G + 0.114B`, normalized to 0-1
- **Color** (`color.ts`): average RGB across all pixels in the cell

### 4. Character mapping (`src/processing/mapper.ts`)

For each cell's brightness value:

1. Select a font size tier based on brightness thresholds (dark cells get smaller characters, bright cells get larger ones)
2. Binary search within the tier's sorted brightness list to find the closest match
3. Score nearby candidates (+-20 entries) using weighted brightness error, width error, and a repetition penalty to avoid runs of the same character

### 5. Rendering (`src/render/`)

Styled characters are drawn to an HTML canvas. A `BitmapCache` pre-renders character+font+color combinations to `ImageBitmap` objects for fast blitting during animation (with LRU eviction at 2000 entries). Handles high-DPI displays via `devicePixelRatio` scaling.

### 6. Animation (`src/animation/`)

`AnimationLoop` drives playback using `requestAnimationFrame` with per-frame delay support (important for GIFs with variable frame timing). `FrameBuffer` lazily processes frames on demand and caches the results.

## Project structure

```
src/
  main.ts              # Entry point, DOM wiring, file loading
  types.ts             # Shared TypeScript types

  input/
    frame-source.ts    # Unified file loader (routes to gif/video/image decoder)
    gif-decoder.ts     # GIF frame extraction with disposal compositing
    video-decoder.ts   # Video frame extraction at target FPS

  processing/
    palette.ts         # Pre-computed character brightness palette
    sampler.ts         # Per-cell brightness sampling
    color.ts           # Per-cell color averaging
    mapper.ts          # Brightness-to-character selection with scoring

  render/
    canvas.ts          # Canvas rendering with color modes
    bitmap-cache.ts    # LRU ImageBitmap cache for animation performance

  animation/
    buffer.ts          # Lazy frame processing and caching
    loop.ts            # requestAnimationFrame-based playback controller
    controls.ts        # Playback UI (play/pause, seek, speed, loop)

  ui/
    export.ts          # WebM video recording from canvas
    resize.ts          # Debounced ResizeObserver utility
```

## Tech stack

- **[Vite](https://vite.dev/)** -- dev server and bundler
- **TypeScript** -- strict mode
- **[`@chenglou/pretext`](https://github.com/chenglou/pretext)** -- DOM-free text measurement for palette building
- **[`gifuct-js`](https://github.com/nichibio/gifuct-js)** -- GIF frame decoding
- **Canvas API** -- all rendering, no DOM text nodes
- **OffscreenCanvas + ImageBitmap** -- cached character rendering for animation performance

No frameworks. No virtual DOM. Just canvas.

## Color modes

| Mode | Description |
|------|-------------|
| `source` | Preserves the original pixel colors (clamped to min 30 per channel for visibility) |
| `tint` | Applies a single user-selected color, modulated by brightness |
| `mono` | Grayscale based on cell brightness |
| `matrix` | Green terminal ramp (dark green to bright green) |
| `amber` | Warm CRT ramp (dark amber to bright amber) |
| `neon` | Multi-hue ramp cycling through magenta, cyan, and yellow |
| `ice` | Cool blue tone ramp |

## Browser support

Requires a modern browser with:

- Canvas 2D / OffscreenCanvas
- `ImageBitmap`
- `requestAnimationFrame`
- ES modules

Tested in Chrome, Firefox, and Safari.

## License

MIT
