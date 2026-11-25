import { clamp, hash, isPlayingNow, rng, specLevel } from './kit'

/** Intensity 0..1 at normalized (u, v), time t (s); aspect = width / height. */
export type Field = (u: number, v: number, t: number, aspect: number) => number

const xy = (u: number, v: number, a: number): [number, number] => [(u - 0.5) * a, v - 0.5]
// Soft light from the top-left, like paper under a lamp.
const light = (x: number, y: number): number => 0.55 - x * 0.25 - y * 0.35

/** Section illustrations for the covers. */
export const ART: Record<string, Field> = {
  // A quiet waveform; becomes the live spectrum while something plays.
  songs: (u, v, t, a) => {
    // Both drawings span a centred band about 2.3 cover-heights wide
    const w = ((u - 0.5) * a) / 2.3 + 0.5
    if (w < 0 || w > 1) return 0
    if (!isPlayingNow()) {
      const y = 0.55 + 0.12 * Math.sin(w * 11 + t * 0.8) * Math.sin(w * Math.PI)
      return Math.exp(-((v - y) ** 2) / 0.0012) * 0.9 + 0.12 * (1 - v)
    }
    const n = 30
    const i = Math.floor(w * n)
    const inBar = (w * n) % 1 < 0.72
    const h = specLevel(i, n, t)
    const base = 0.8
    const top = base - h * 0.68
    if (inBar && v < base && v > top) return 0.55 + 0.45 * (1 - (v - top) / (base - top + 0.001))
    const refl = (base - top) * 0.25
    if (inBar && v >= base && v < base + refl) return 0.3 * (1 - (v - base) / (refl + 0.001))
    return 0.06 * (1 - v)
  },

  // Three busts.
  artists: (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    let best = 0
    for (const [cx, s] of [
      [-0.55, 0.78],
      [0.55, 0.82],
      [0, 1]
    ]) {
      const hx = (x - cx) / s
      const hy = (y + 0.08) / s
      const head = Math.hypot(hx * 1.1, hy + 0.12)
      const body = Math.hypot(hx * 0.7, (hy - 0.52) * 1.15)
      if (head < 0.2 || (body < 0.36 && hy > 0.2))
        best = Math.max(
          best,
          clamp(light(hx, hy) + 0.25 * s + 0.03 * Math.sin(t + cx * 4), 0.08, 1)
        )
    }
    return best || 0.05 + 0.08 * (1 - v)
  },

  // A record whose grooves catch the light as it turns.
  albums: (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    const d = Math.hypot(x, y) / 0.42
    const ang = Math.atan2(y, x)
    if (d > 1) return 0.04 + 0.06 * (1 - v)
    if (d < 0.32) return d < 0.06 ? 0 : 0.85 - d
    const shine =
      Math.max(0, Math.cos(ang - t * 0.9)) ** 8 +
      Math.max(0, Math.cos(ang - t * 0.9 - Math.PI)) ** 8
    return 0.35 + 0.1 * Math.sin(d * 70) + 0.5 * shine * (1 - d * 0.4)
  },

  // A stack of index cards.
  playlists: (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    let val = 0.04
    ;[
      [-0.2, 0.08, 0.14],
      [0, -0.02, -0.06],
      [0.18, 0.06, 0.05]
    ].forEach(([cx, cy, rot], k) => {
      const ca = Math.cos(rot + 0.02 * Math.sin(t * 0.6 + k))
      const sa = Math.sin(rot)
      const xr = (x - cx) * ca + (y - cy) * sa
      const yr = -(x - cx) * sa + (y - cy) * ca
      if (Math.abs(xr) < 0.42 && Math.abs(yr) < 0.27) {
        const lines = Math.abs((((yr + 0.27) * 22) % 1) - 0.5) < 0.08 && yr > -0.15 ? 0.35 : 0
        val = 0.2 + k * 0.12 + lines + (yr < -0.18 ? 0.35 : 0)
      }
    })
    return val
  },

  // An arrow dropping into an archive drawer.
  downloads: (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    const fall = (t * 0.45) % 1
    const box = Math.abs(x) < 0.5 && y > 0.12 && y < 0.42
    const rim = box && y < 0.17
    const ay = y + 0.32 - fall * 0.28
    const shaft = Math.abs(x) < 0.05 && ay > -0.25 && ay < 0.02
    const head = ay >= 0.02 && ay < 0.14 && Math.abs(x) < 0.15 * (1 - (ay - 0.02) / 0.12)
    if (rim) return 0.95
    if (box)
      return 0.25 + 0.9 * (y - 0.12) + (Math.abs(x) < 0.12 && Math.abs(y - 0.27) < 0.03 ? 0.4 : 0)
    if ((shaft || head) && y < 0.12) return 0.85
    const dust =
      Math.abs(x) < 0.6 &&
      y < 0.1 &&
      hash(`${Math.floor(u * 60)}:${Math.floor((v - t * 0.08) * 40)}`) % 100 > 96
        ? 0.5
        : 0
    return dust + 0.04
  },

  // A dial with ticks and two faders.
  settings: (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    const dx = x + 0.45
    const d = Math.hypot(dx, y)
    const ang = Math.atan2(y, dx)
    if (d < 0.26) {
      const rel = ((ang - ((t * 0.25) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI
      return Math.abs(rel) < 0.08 && d > 0.08 ? 1 : clamp(light(dx * 2, y * 2) + 0.1, 0.15, 0.8)
    }
    if (d < 0.33 && d > 0.29 && Math.abs((ang * 12) / Math.PI) % 1 < 0.25) return 0.7
    for (const [fx, k] of [
      [0.3, 0],
      [0.62, 1]
    ]) {
      if (Math.abs(x - fx) < 0.012 && Math.abs(y) < 0.3) return 0.45
      const ky = 0.2 * Math.sin(t * 0.5 + k * 2)
      if (Math.abs(x - fx) < 0.08 && Math.abs(y - ky) < 0.04) return 0.9
    }
    return 0.04
  }
}

const covers = new Map<string, Field>()

/** Seeded generative cover for an album or playlist, or a portrait for an artist. */
export function coverFn(seed: string, portrait = false): Field {
  const key = `${portrait ? 'p' : 'c'}:${seed}`
  const cached = covers.get(key)
  if (cached) return cached
  const R = rng(hash(seed))
  const k = portrait ? 9 : Math.floor(R() * 4)
  const cx = (R() - 0.5) * 0.4
  const cy = (R() - 0.5) * 0.4
  const f = 3 + R() * 5
  // portrait variations: head size, tilt, height, shoulders and background
  const pHead = 0.16 + R() * 0.07
  const pTilt = (R() - 0.5) * 0.14
  const pLift = (R() - 0.5) * 0.06
  const pBody = 0.29 + R() * 0.09
  const pBg = Math.floor(R() * 3)
  const fn: Field = (u, v, t, a) => {
    const [x, y] = xy(u, v, a)
    if (k === 9) {
      const head = Math.hypot((x - pTilt) * 1.1, y + 0.14 - pLift)
      const body = Math.hypot(x * 0.68, (y - 0.42) * 1.1)
      if (head < pHead || (body < pBody && y > 0.16)) return clamp(light(x, y) + 0.25, 0.1, 1)
      if (pBg === 0) return 0.12 + 0.1 * Math.sin((x + y) * f * 4 + t * 0.5)
      if (pBg === 1) return 0.1 + 0.12 * Math.sin(Math.hypot(x, y + 0.1) * f * 7 - t * 0.6)
      const gx = (((x + 1) * f) % 1) - 0.5
      const gy = (((y + 1) * f) % 1) - 0.5
      return Math.hypot(gx, gy) < 0.16 ? 0.3 : 0.06
    }
    if (k === 0) {
      const d = Math.hypot(x - cx, y - cy)
      return 1 - d * 2.3 + 0.12 * Math.sin(d * f * 8 - t)
    }
    if (k === 1) return 0.5 + 0.45 * Math.sin((x * f + y * 2) * 3 + t * 0.6) * (1 - Math.abs(y))
    if (k === 2) {
      const hz = 0.1 + 0.08 * Math.sin(x * f + t * 0.4)
      return y > hz ? 0.8 - (y - hz) : Math.hypot(x - cx, y + 0.22) < 0.1 ? 0.95 : 0.12
    }
    const gx = (((x + 1) * f) % 1) - 0.5
    const gy = (((y + 1) * f) % 1) - 0.5
    return 0.95 - Math.hypot(gx, gy) * 2.6 + 0.15 * Math.sin(t + x * 4)
  }
  covers.set(key, fn)
  return fn
}

/** The record used as the app mark. */
export const logoFn: Field = (u, v, t) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2
  if (d > 0.92) return 0
  if (d < 0.22) return d < 0.08 ? 0 : 0.95
  return (
    0.35 +
    0.08 * Math.sin(d * 40) +
    0.5 * Math.max(0, Math.cos(Math.atan2(v - 0.5, u - 0.5) - t)) ** 6
  )
}

/** A few lines of seeded ASCII texture for playlist index cards. */
export function asciiStrip(seed: string): string {
  const R = rng(hash(seed))
  return Array.from({ length: 3 }, () =>
    Array.from({ length: 26 }, () => ' .:-=+*#'[Math.floor(R() * R() * 8)]).join('')
  ).join('\n')
}
