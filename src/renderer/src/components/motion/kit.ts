import { useSyncExternalStore } from 'react'
import { usePlayerStore } from '../../store/playerStore'
import { getAnalyser } from '../../hooks/audioAnalyser'

/** Palette shared with Budasswords ("Quiet Archive"). Keep in sync with app.css. */
export const C = {
  bg0: '#F5F2EB',
  bg1: '#FAF8F3',
  bg2: '#FFFFFF',
  bg3: '#EFECE4',
  accent: '#BA5A3A',
  soft: '#D47758',
  dim: '#E9CFC4',
  shade: '#9E4A2E',
  text: '#22201D',
  text2: '#767169',
  text3: '#A5A097',
  border: '#DDD9D0',
  success: '#3A604A',
  warning: '#D97706',
  danger: '#C0392B'
}
export type Tone = keyof typeof C

const LIGHT = { ...C }
/** Night palette. Keep in sync with the dark block in app.css. */
const DARK: typeof C = {
  bg0: '#191714',
  bg1: '#1F1D19',
  bg2: '#26231F',
  bg3: '#312D28',
  accent: '#CF6B4A',
  soft: '#A85234',
  dim: '#4A2E22',
  shade: '#E9A084',
  text: '#EDE8DF',
  text2: '#A39D92',
  text3: '#6F6A62',
  border: '#38342E',
  success: '#74A888',
  warning: '#E8A23A',
  danger: '#E06B5C'
}

/**
 * Dither tones from faint to strong. On paper the strongest tone is the darkest; at night it
 * is the brightest, so the same ramp works on both backgrounds.
 */
export const TONES: string[] = []

const darkQuery =
  typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
const themeListeners = new Set<() => void>()
let dark = false

function applyTheme(): void {
  dark = !!darkQuery?.matches
  Object.assign(C, dark ? DARK : LIGHT)
  TONES.splice(0, TONES.length, C.dim, C.soft, C.accent, C.shade)
  themeListeners.forEach((cb) => cb())
}
applyTheme()
darkQuery?.addEventListener('change', applyTheme)

/** Re-renders the caller when the theme flips (for canvases that only draw on change). */
export function useDark(): boolean {
  return useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb)
      return () => themeListeners.delete(cb)
    },
    () => dark
  )
}

/** Rule of thumb: ASCII for data moments, dither for time and transitions. */
export const REDUCE =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const GLYPHS = '0123456789abcdef#$%&*+=<>/\\|{}[]?!~^'
export const BRAILLE = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
export const BARS = '▁▂▃▄▅▆▇█'

export const glyph = (i: number, s: number): string =>
  GLYPHS[((Math.imul(i + 1, 2654435761) ^ Math.imul(s + 7, 40503)) >>> 0) % GLYPHS.length]

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v))
export const ease = (x: number): number => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)
export const smooth = (a: number, b: number, x: number): number => {
  const k = clamp((x - a) / (b - a), 0, 1)
  return k * k * (3 - 2 * k)
}

export function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rng(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Ordered-dither threshold matrix (bits = 2 → 4×4, bits = 3 → 8×8), values in (0, 1). */
function makeBayer(bits: number): (x: number, y: number) => number {
  const s = 1 << bits
  const m = new Float32Array(s * s)
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      let v = 0
      for (let i = 0; i < bits; i++) {
        const xb = (x >> i) & 1
        const yb = (y >> i) & 1
        v |= (((xb ^ yb) << 1) | yb) << (2 * (bits - 1 - i))
      }
      m[y * s + x] = (v + 0.5) / (s * s)
    }
  return (x, y) => m[(y % s) * s + (x % s)]
}
export const B4 = makeBayer(2)
export const B8 = makeBayer(3)

// ─── One shared frame loop (~12 fps) for every animated surface ──────────────

type FrameCb = (t: number, frame: number) => void
const subscribers = new Set<FrameCb>()
let raf = 0
let last = 0
let frame = 0

function tick(now: number): void {
  raf = requestAnimationFrame(tick)
  if (now - last < 80) return
  last = now
  frame++
  for (const cb of subscribers) cb(now / 1000, frame)
}

export function onFrame(cb: FrameCb): () => void {
  subscribers.add(cb)
  if (!raf) raf = requestAnimationFrame(tick)
  return () => {
    subscribers.delete(cb)
    if (!subscribers.size) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }
}

// ─── Spectrum: one source for the ASCII meter and the "Canciones" cover ─────────

let playing = usePlayerStore.getState().isPlaying
usePlayerStore.subscribe((s) => {
  playing = s.isPlaying
})

export const isPlayingNow = (): boolean => playing

// Real spectrum: the analyser is read at most every 25 ms and split into n log-spaced bands
// (cached per n, since the cover asks for every cell).
let freq: Uint8Array<ArrayBuffer> | null = null
let readAt = 0
const bandCache = new Map<number, Float32Array>()

function realBands(n: number): Float32Array | null {
  const analyser = getAnalyser()
  if (!analyser) return null
  const now = performance.now()
  if (!freq || now - readAt > 25) {
    if (!freq || freq.length !== analyser.frequencyBinCount)
      freq = new Uint8Array(analyser.frequencyBinCount)
    // The analyser hears the audio after the volume control. Shift its dB window by the volume
    // so the bars look the same at any volume (byte values map min..max dB linearly).
    const { volume, isMuted } = usePlayerStore.getState()
    const offset = Math.max(-50, 20 * Math.log10(isMuted ? 0.003 : Math.max(volume, 0.003)))
    analyser.minDecibels = -100 + offset
    analyser.maxDecibels = -30 + offset
    analyser.getByteFrequencyData(freq)
    readAt = now
    bandCache.clear()
  }
  let bands = bandCache.get(n)
  if (bands) return bands
  bands = new Float32Array(n)
  const lo = 2 // skip DC
  const hi = Math.floor(freq.length * 0.72) // ~16 kHz at 44.1 kHz
  for (let i = 0; i < n; i++) {
    const a = Math.floor(lo * Math.pow(hi / lo, i / n))
    const b = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (i + 1) / n)))
    let sum = 0
    for (let k = a; k < b; k++) sum += freq[k]
    // Highs carry less energy: tilt them up a little so the right side moves too
    bands[i] = clamp(Math.pow(sum / (b - a) / 255, 1.5) * (1 + (i / n) * 0.8), 0, 1)
  }
  bandCache.set(n, bands)
  return bands
}

/** Level 0..1 of band i out of n at time t. Flat while paused. */
export function specLevel(i: number, n: number, t: number): number {
  if (!playing) return 0.04 + 0.02 * Math.sin(i * 0.7 + t)
  const real = realBands(n)
  if (real) return Math.max(0.03, real[Math.min(n - 1, i)])
  const x = i / n
  const beat = Math.max(0, Math.sin(t * 4.2)) ** 6
  return clamp(
    0.18 +
      0.55 * Math.abs(Math.sin(x * 9 + t * 2.3) * Math.cos(x * 3.7 - t * 1.4)) +
      0.3 * beat * Math.exp(-((x - 0.45) ** 2) / 0.05),
    0,
    1
  )
}

export function spectrumText(n: number, t: number, stride = 1): string {
  let out = ''
  for (let i = 0; i < n; i++)
    out += BARS[Math.min(7, Math.floor(specLevel(i * stride, n * stride, t) * 8))]
  return out
}
