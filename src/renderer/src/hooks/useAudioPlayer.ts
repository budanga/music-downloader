import { useEffect, useRef } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '../store/playerStore'
import { attachAnalyser } from './audioAnalyser'
import type { Song } from '../../../shared/types'

/**
 * useAudioPlayer — bridges Howler.js with the Zustand player store.
 * Manages a single Howl instance that is replaced when the current song changes.
 */
export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  const rafRef = useRef<number | null>(null)
  // Subscribe field by field: subscribing to the whole store would re-render the app on every time update
  const currentSong = usePlayerStore((s) => s.currentSong)
  const playId = usePlayerStore((s) => s.playId)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const volume = usePlayerStore((s) => s.volume)
  const isMuted = usePlayerStore((s) => s.isMuted)
  const seekToTarget = usePlayerStore((s) => s.seekToTarget)
  const { setCurrentTime, setDuration, setIsPlaying, next, clearSeekToTarget } =
    usePlayerStore.getState()

  // ─── Create/Replace Howl instance when song changes ────────────────────────
  useEffect(() => {
    if (!currentSong) return

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // Use a virtual host 'library' for proper Range request support.
    // NOTE: No cache-busting timestamp here — adding ?t=... changes the URL on every seek,
    // which causes Howler to reload the entire audio file from position 0.
    const src = `music://library/${encodeURIComponent(currentSong.filePath)}`

    // RAF-based progress tracking
    const trackProgress = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      const step = () => {
        const howl = howlRef.current
        if (!howl) return
        const pos = howl.seek() as number
        // Throttle store writes to ~4/s instead of one per frame
        if (
          typeof pos === 'number' &&
          Math.abs(pos - usePlayerStore.getState().currentTime) >= 0.25
        ) {
          setCurrentTime(pos)
        }
        rafRef.current = requestAnimationFrame(step)
      }
      rafRef.current = requestAnimationFrame(step)
    }

    const howl = new Howl({
      src: [src],
      html5: true, // Use HTML5 audio for proper streaming and seeking with the native file protocol
      format: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'aac'], // explicit formats to prevent parser guessing errors
      volume: isMuted ? 0 : volume,
      onload: () => {
        setDuration(howl.duration())
      },
      onplay: () => {
        setIsPlaying(true)
        trackProgress()
        // Feed the spectrum with the real audio
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node: HTMLAudioElement | undefined = (howl as any)._sounds?.[0]?._node
        if (node) attachAnalyser(node)
      },
      onpause: () => {
        setIsPlaying(false)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      },
      onstop: () => {
        setIsPlaying(false)
        if (rafRef.current) cancelAnimationFrame(rafRef.current)
      },
      onend: () => {
        // next() also handles repeat-one: it bumps playId, which re-runs this effect with a
        // fresh Howl. (Restarting this Howl here doesn't work: Howler stops it right after.)
        next(true)
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
        setIsPlaying(false)
      },
      onplayerror: (_id, err) => {
        console.error('Howl play error:', err)
        setIsPlaying(false)
        howl.once('unlock', () => howl.play())
      }
    })

    howlRef.current = howl

    if (isPlaying) {
      howl.play()
    }

    // Increment play count in DB
    if (currentSong.id) {
      window.api.library.incrementPlayCount(currentSong.id).catch(console.error)
    }

    return () => {
      if (howl) {
        howl.stop()
        howl.unload()
      }
      if (howlRef.current === howl) {
        howlRef.current = null
      }
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, playId])

  // ─── Sync play/pause state ─────────────────────────────────────────────────
  useEffect(() => {
    const howl = howlRef.current
    if (!howl) return
    if (isPlaying && !howl.playing()) {
      howl.play()
    } else if (!isPlaying && howl.playing()) {
      howl.pause()
    }
  }, [isPlaying])

  // ─── Sync volume ───────────────────────────────────────────────────────────
  useEffect(() => {
    howlRef.current?.volume(isMuted ? 0 : volume)
  }, [volume, isMuted])

  // ─── External Seek trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (seekToTarget === null) return

    const target = seekToTarget
    clearSeekToTarget()
    setCurrentTime(target)

    const howl = howlRef.current
    if (!howl) return

    // Howler's howl.seek() can internally call audio.load() in some browsers/setups,
    // resetting playback to 0:00. We bypass it by seeking directly on the underlying
    // HTMLAudioElement that Howler manages internally.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sound = (howl as any)._sounds?.[0]
    const audioNode: HTMLAudioElement | undefined = sound?._node

    if (audioNode) {
      // eslint-disable-next-line react-hooks/immutability -- seeking a DOM audio element, not React state
      audioNode.currentTime = target
    } else {
      howl.seek(target)
    }
  }, [seekToTarget, setCurrentTime, clearSeekToTarget])

  return {}
}

/** Format seconds → mm:ss */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Play a single song or a list starting at an index */
export function playSong(song: Song, queue?: Song[], index?: number) {
  const store = usePlayerStore.getState()
  if (queue && index !== undefined) {
    store.setQueue(queue, index)
  } else {
    store.setQueue([song], 0)
  }
}
