export type FontStyleVariant = 'normal' | 'italic'

export type PaletteEntry = {
  char: string
  weight: number
  style: FontStyleVariant
  font: string
  width: number
  brightness: number
}

export type StyledChar = {
  entry: PaletteEntry
  r: number
  g: number
  b: number
}

export type Grid<T> = {
  cols: number
  rows: number
  data: T[]
}

export type FrameData = {
  imageData: ImageData
  width: number
  height: number
}
