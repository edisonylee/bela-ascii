/**
 * Debounced ResizeObserver that fires a callback when the observed element changes size.
 */
export function observeResize(
  element: HTMLElement,
  onResize: (width: number, height: number) => void,
  debounceMs: number = 150,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const observer = new ResizeObserver((entries) => {
    const entry = entries[0]
    if (!entry) return

    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      const { width, height } = entry.contentRect
      onResize(width, height)
    }, debounceMs)
  })

  observer.observe(element)

  return () => {
    if (timer) clearTimeout(timer)
    observer.disconnect()
  }
}
