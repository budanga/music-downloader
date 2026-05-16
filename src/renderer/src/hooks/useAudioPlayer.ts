import { useEffect, useRef, useCallback } from 'react'
import { Howl } from 'howler'
import { usePlayerStore } from '../store/playerStore'
import type { Song } from '../../shared/types'

/**
 * useAudioPlayer — bridges Howler.js with the Zustand player store.
 * Manages a single Howl instance that is replaced when the current song changes.
 */
export function useAudioPlayer() {
  const howlRef = useRef<Howl | null>(null)
  const rafRef = useRef<number | null>(null)
  const store = usePlayerStore()

  const {
    currentSong,
    isPlaying,
    volume,
    isMuted,
    repeatMode,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    next,
  } = store

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

    const howl = new Howl({
      src: [src],
      html5: true,   // Use HTML5 audio for proper streaming and seeking with the native file protocol
      format: ['mp3', 'flac', 'm4a', 'wav', 'ogg', 'aac'], // explicit formats to prevent parser guessing errors
      volume: isMuted ? 0 : volume,
      onload: () => {
        setDuration(howl.duration())
      },
      onplay: () => {
        setIsPlaying(true)
        trackProgress()
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
        if (repeatMode === 'one') {
          howl.seek(0)
          howl.play()
        } else {
          next()
        }
      },
      onloaderror: (_id, err) => {
        console.error('Howl load error:', err)
        setIsPlaying(false)
      },
      onplayerror: (_id, err) => {
        console.error('Howl play error:', err)
        setIsPlaying(false)
        howl.once('unlock', () => howl.play())
      },
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
  }, [currentSong?.id])

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

  // ─── RAF-based progress tracking ──────────────────────────────────────────
  const trackProgress = useCallback(() => {
    const step = () => {
      const howl = howlRef.current
      if (!howl) return
      const pos = howl.seek() as number
      if (typeof pos === 'number') setCurrentTime(pos)
      rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
  }, [setCurrentTime])

  // ─── External Seek trigger ────────────────────────────────────────────────
  useEffect(() => {
    if (store.seekToTarget === null) return

    const target = store.seekToTarget
    store.clearSeekToTarget()
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
      audioNode.currentTime = target
    } else {
      howl.seek(target)
    }
  }, [store.seekToTarget, setCurrentTime, store])

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
