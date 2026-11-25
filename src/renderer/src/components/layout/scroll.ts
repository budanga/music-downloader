/** The page scroll container (<main id="main-scroll">). */
export const mainScroll = (): HTMLElement | null => document.getElementById('main-scroll')

export function scrollMainToTop(): void {
  const el = mainScroll()
  if (el) el.scrollTop = 0
}

export const totalDuration = (seconds: number): string => {
  const m = Math.round(seconds / 60)
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`
}
