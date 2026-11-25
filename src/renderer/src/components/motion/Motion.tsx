import { useEffect, useRef } from 'react'
import type { Field } from './art'
import {
  B4,
  B8,
  BRAILLE,
  C,
  REDUCE,
  TONES,
  clamp,
  ease,
  glyph,
  onFrame,
  spectrumText,
  useDark,
  type Tone
} from './kit'

const MORPH_MS = 520
/**
 * Last picture shown by each memory slot, so a new mount can morph from it. `from`/`since`
 * describe a morph in progress, so a remount (React StrictMode mounts twice) resumes it.
 */
const memory = new Map<string, { field: Field; from?: Field; since?: number }>()

interface DitherCanvasProps {
  field: Field
  /** Cell size in CSS px */
  px?: number
  /** Use the 8×8 matrix (finer gradients, for large surfaces) */
  fine?: boolean
  className?: string
  /**
   * Remembers the picture across mounts: a canvas with the same key morphs from whatever the
   * previous one showed (used by the section covers when you change section).
   */
  memoryKey?: string
}

/**
 * Animated ordered-dither drawing in terracotta tones. When the picture changes, the old one
 * dissolves into the new one cell by cell, in Bayer order. Pauses while off screen.
 */
export function DitherCanvas({
  field,
  px = 3,
  fine = false,
  className,
  memoryKey
}: DitherCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const state = useRef({
    field,
    prev: null as Field | null,
    mixT: 0,
    raf: 0,
    draw: (() => {}) as (t: number) => void
  })

  // While a morph runs, draw every frame instead of at the shared ~12 fps.
  const morphFrom = (from: Field, since = performance.now()) => {
    const s = state.current
    if (from === s.field) return
    if (REDUCE) {
      s.draw(performance.now() / 1000)
      return
    }
    s.prev = from
    s.mixT = since
    cancelAnimationFrame(s.raf)
    const loop = (now: number) => {
      s.draw(now / 1000)
      if (s.prev) s.raf = requestAnimationFrame(loop)
    }
    s.raf = requestAnimationFrame(loop)
  }

  // Repaint at once with the new palette (matters when motion is reduced and nothing animates)
  const dark = useDark()
  useEffect(() => state.current.draw(performance.now() / 1000), [dark])

  useEffect(() => {
    const s = state.current
    if (s.field === field) return // first mount: the mount effect below reads the memory
    const from = s.field
    const since = performance.now()
    if (memoryKey) memory.set(memoryKey, { field, from, since })
    s.field = field
    morphFrom(from, since)
  }, [field, memoryKey])

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const s = state.current
    const bayer = fine ? B8 : B4
    let visible = true

    s.draw = (t: number) => {
      const W = cv.width
      const H = cv.height
      if (W < 2 || H < 2) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const cell = Math.max(2, Math.round(px * dpr))
      const cols = Math.ceil(W / cell)
      const rows = Math.ceil(H / cell)
      const aspect = W / H
      const prev = s.prev
      const mix = prev ? ease(clamp((performance.now() - s.mixT) / MORPH_MS, 0, 1)) : 1
      if (mix >= 1) s.prev = null
      const n = TONES.length
      ctx.clearRect(0, 0, W, H)
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++) {
          const th = bayer(c, r)
          // Dither dissolve: each cell switches to the new picture once the transition passes
          // its Bayer threshold, so the change spreads in the matrix's ordered pattern.
          const fn = prev && th > mix ? prev : s.field
          const val = fn((c + 0.5) / cols, (r + 0.5) / rows, t, aspect)
          const lv = Math.floor(clamp(val, 0, 1) * n + th - 0.5)
          if (lv < 1) continue
          ctx.fillStyle = TONES[Math.min(lv, n) - 1]
          ctx.fillRect(c * cell, r * cell, cell, cell)
        }
    }

    const resize = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      cv.width = Math.max(1, Math.round(r.width * dpr))
      cv.height = Math.max(1, Math.round(r.height * dpr))
      s.draw(performance.now() / 1000)
    }
    // Pick up the morph before the first draw, so the new picture never flashes in first.
    if (memoryKey) {
      const m = memory.get(memoryKey)
      const now = performance.now()
      if (m && m.field !== s.field) {
        memory.set(memoryKey, { field: s.field, from: m.field, since: now })
        morphFrom(m.field, now)
      } else if (m?.from && m.since !== undefined && now - m.since < MORPH_MS) {
        morphFrom(m.from, m.since)
      } else memory.set(memoryKey, { field: s.field })
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(cv)
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
    })
    io.observe(cv)
    const off = onFrame((t) => {
      if (visible && !s.prev && !REDUCE) s.draw(t)
    })
    return () => {
      off()
      cancelAnimationFrame(s.raf)
      s.prev = null
      ro.disconnect()
      io.disconnect()
    }
    // morphFrom only touches the ref; memoryKey is fixed for a given canvas
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [px, fine])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}

interface DitherBarProps {
  value: number
  /** Palette names, so the bar follows the light/dark theme */
  color?: Tone
  track?: Tone
  className?: string
  /** Makes the bar a slider. Receives 0..1 while dragging. */
  onSeek?: (value: number) => void
  /** Called once with the final value when the drag (or key press) ends. */
  onCommit?: (value: number) => void
  label?: string
}

/** Progress bar whose edge erodes in a Bayer pattern. */
export function DitherBar({
  value,
  color = 'accent',
  track = 'bg3',
  className,
  onSeek,
  onCommit,
  label
}: DitherBarProps) {
  const dark = useDark()
  const ref = useRef<HTMLCanvasElement>(null)
  const dragging = useRef(false)
  const lastValue = useRef(value)

  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const draw = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const W = Math.max(1, Math.round(r.width * dpr))
      const H = Math.max(1, Math.round(r.height * dpr))
      if (cv.width !== W || cv.height !== H) {
        cv.width = W
        cv.height = H
      }
      const ctx = cv.getContext('2d')
      if (!ctx) return
      const cell = Math.max(2, Math.round(2 * dpr))
      const cols = Math.ceil(W / cell)
      const rows = Math.ceil(H / cell)
      const soft = 10
      const edge = clamp(value, 0, 1) * (cols + soft) - soft / 2
      ctx.fillStyle = C[track]
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = C[color]
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++)
          if (clamp((edge - x) / soft + 0.5, 0, 1) > B4(x, y))
            ctx.fillRect(x * cell, y * cell, cell, cell)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [value, color, track, dark])

  if (!onSeek) return <canvas ref={ref} className={className} aria-hidden="true" />

  const at = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    lastValue.current = clamp((e.clientX - r.left) / r.width, 0, 1)
    return lastValue.current
  }
  const step = (delta: number) => {
    const v = clamp(value + delta, 0, 1)
    onSeek(v)
    onCommit?.(v)
  }
  return (
    <canvas
      ref={ref}
      className={className}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      style={{ cursor: 'pointer', touchAction: 'none' }}
      onPointerDown={(e) => {
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onSeek(at(e))
      }}
      onPointerMove={(e) => dragging.current && onSeek(at(e))}
      onPointerUp={(e) => {
        if (!dragging.current) return
        dragging.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        onCommit?.(lastValue.current)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') step(0.05)
        if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') step(-0.05)
      }}
    />
  )
}

/** Shows `text`, passing each character through random glyphs first, left to right. */
export function DecryptText({
  text,
  className,
  ms = 520
}: {
  text: string
  className?: string
  ms?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (REDUCE) {
      el.textContent = text
      return
    }
    const chars = [...text]
    const stops = chars.map(
      (_, i) => 0.25 + (i / Math.max(1, chars.length)) * 0.55 + Math.random() * 0.2
    )
    const t0 = performance.now()
    let raf = 0
    el.classList.add('decrypting')
    const step = (now: number) => {
      const p = (now - t0) / ms
      const k = Math.floor((now - t0) / 40)
      el.textContent = chars
        .map((ch, i) => (ch === ' ' || p >= stops[i] ? ch : glyph(i, k)))
        .join('')
      if (p < 1) raf = requestAnimationFrame(step)
      else {
        el.textContent = text
        el.classList.remove('decrypting')
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      el.textContent = text
      el.classList.remove('decrypting')
    }
  }, [text, ms])

  return <span ref={ref} className={className} title={text} />
}

/** ASCII spectrum (▁▂▃…) that dances while something plays. */
export function AsciiSpectrum({ bands = 26, className }: { bands?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const stride = bands < 6 ? 9 : 1
    el.textContent = spectrumText(bands, 0, stride)
    if (REDUCE) return
    return onFrame((t) => {
      el.textContent = spectrumText(bands, t, stride)
    })
  }, [bands])
  return <span ref={ref} className={className} aria-hidden="true" />
}

/** Text spinner for work in progress. */
export function BrailleSpinner({ className }: { className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.textContent = BRAILLE[0]
    if (REDUCE) return
    return onFrame((_t, frame) => {
      el.textContent = BRAILLE[frame % BRAILLE.length]
    })
  }, [])
  return <span ref={ref} className={`spin ${className ?? ''}`} aria-hidden="true" />
}
