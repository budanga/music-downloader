import { create } from 'zustand'
import type { Song } from '../../../shared/types'

type RepeatMode = 'none' | 'one' | 'all'

function shuffled<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** The original order, keeping only the songs still queued (matched by object, counted). */
function restoreOrder(original: Song[], queue: Song[]): Song[] {
  const left = new Map<Song, number>()
  for (const s of queue) left.set(s, (left.get(s) ?? 0) + 1)
  const out: Song[] = []
  const take = (s: Song) => {
    const n = left.get(s)
    if (!n) return
    out.push(s)
    left.set(s, n - 1)
  }
  original.forEach(take)
  queue.forEach(take) // anything the original never saw goes last
  return out
}

interface PlayerState {
  // Queue
  queue: Song[]
  currentIndex: number
  // Playback state
  isPlaying: boolean
  isShuffle: boolean
  repeatMode: RepeatMode
  volume: number // 0–1
  isMuted: boolean
  currentTime: number // seconds
  duration: number // seconds
  // Derived
  currentSong: Song | null
  seekToTarget: number | null
  /** Bumped every time a track (re)starts, so the same song twice in a row still restarts */
  playId: number
  /**
   * While shuffle is on: the queue in its original order. Shuffling happens once (when it's
   * turned on or a new queue starts); turning it off restores this order.
   */
  originalQueue: Song[] | null

  // Queue actions
  setQueue: (songs: Song[], startIndex?: number) => void
  addToQueue: (song: Song) => void
  /** Adds songs at the end of the queue (starts playing them if nothing is queued) */
  addManyToQueue: (songs: Song[]) => void
  /** Inserts songs right after the current one, in order */
  playNextMany: (songs: Song[]) => void
  removeFromQueue: (index: number) => void
  /** Moves the song at `from` so it ends up at index `to`; the current song keeps playing */
  moveInQueue: (from: number, to: number) => void
  removeBySongId: (id: string) => void
  clearQueue: () => void
  /** Drops every song after the current one */
  clearUpcoming: () => void
  jumpTo: (index: number) => void

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  /**
   * `auto`: the song ended on its own. With repeat-one the same song starts over. Skipping
   * past the last song does nothing.
   */
  next: (auto?: boolean) => void
  previous: () => void
  playNext: (song: Song) => void
  seekTo: (seconds: number) => void
  clearSeekToTarget: () => void
  setVolume: (vol: number) => void
  toggleMute: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  setCurrentTime: (t: number) => void
  setDuration: (d: number) => void
  setIsPlaying: (v: boolean) => void
  updateSongMetadata: (song: Song) => void
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  currentIndex: 0,
  isPlaying: false,
  isShuffle: false,
  repeatMode: 'none',
  volume: 0.8,
  isMuted: false,
  currentTime: 0,
  duration: 0,
  currentSong: null,
  seekToTarget: null,
  playId: 0,
  originalQueue: null,

  setQueue: (songs, startIndex = 0) => {
    set((s) => {
      // With shuffle on, the chosen song plays first and the rest come in random order
      const first = songs[startIndex]
      const queue =
        s.isShuffle && first
          ? [first, ...shuffled(songs.filter((_, i) => i !== startIndex))]
          : songs
      const index = s.isShuffle && first ? 0 : startIndex
      return {
        queue,
        originalQueue: s.isShuffle ? songs : null,
        currentIndex: index,
        currentSong: queue[index] ?? null,
        isPlaying: songs.length > 0,
        currentTime: 0,
        playId: s.playId + 1
      }
    })
  },

  addToQueue: (song) => get().addManyToQueue([song]),

  addManyToQueue: (songs) => {
    if (!songs.length) return
    if (!get().currentSong) return get().setQueue(songs, 0)
    set((s) => ({
      queue: [...s.queue, ...songs],
      originalQueue: s.originalQueue && [...s.originalQueue, ...songs]
    }))
  },

  playNextMany: (songs) => {
    if (!songs.length) return
    if (!get().currentSong) return get().setQueue(songs, 0)
    set((s) => {
      const queue = [...s.queue]
      queue.splice(s.currentIndex + 1, 0, ...songs)
      let originalQueue = s.originalQueue
      if (originalQueue) {
        // Also right after the current song in the original order, so unshuffling keeps them next
        originalQueue = [...originalQueue]
        const at = originalQueue.indexOf(s.queue[s.currentIndex])
        originalQueue.splice(at + 1, 0, ...songs)
      }
      return { queue, originalQueue }
    })
  },

  removeFromQueue: (index) => {
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      const newIndex =
        index < s.currentIndex ? s.currentIndex - 1 : Math.min(s.currentIndex, newQueue.length - 1)
      if (index !== s.currentIndex) return { queue: newQueue, currentIndex: newIndex }
      return {
        queue: newQueue,
        currentIndex: newIndex,
        currentSong: newQueue[newIndex] ?? null,
        currentTime: 0,
        isPlaying: s.isPlaying && newQueue.length > 0,
        playId: s.playId + 1
      }
    })
  },

  moveInQueue: (from, to) => {
    set((s) => {
      if (from === to || !s.queue[from] || to < 0 || to >= s.queue.length) return {}
      const queue = [...s.queue]
      queue.splice(to, 0, queue.splice(from, 1)[0])
      let currentIndex = s.currentIndex
      if (from === currentIndex) currentIndex = to
      else if (from < currentIndex && to >= currentIndex) currentIndex--
      else if (from > currentIndex && to <= currentIndex) currentIndex++
      return { queue, currentIndex }
    })
  },

  removeBySongId: (id) => {
    set((s) => {
      const isCurrent = s.currentSong?.id === id
      const newQueue = s.queue.filter((song) => song.id !== id)

      if (newQueue.length === 0) {
        return { queue: [], currentIndex: 0, currentSong: null, isPlaying: false, currentTime: 0 }
      }

      if (isCurrent) {
        // If we delete the song currently playing, stop playback and move cursor to the next song
        let newIndex = s.currentIndex
        if (newIndex >= newQueue.length) newIndex = 0
        return {
          queue: newQueue,
          currentIndex: newIndex,
          currentSong: newQueue[newIndex],
          currentTime: 0,
          isPlaying: false // Safest to stop to release Windows file locks
        }
      } else {
        // If we delete a DIFFERENT song, just update the queue and find the new index of our current song
        let newIndex = newQueue.findIndex((song) => song.id === s.currentSong?.id)
        if (newIndex === -1) newIndex = 0 // Fallback
        return {
          queue: newQueue,
          currentIndex: newIndex
        }
      }
    })
  },

  clearQueue: () =>
    set({ queue: [], originalQueue: null, currentIndex: 0, currentSong: null, isPlaying: false }),
  clearUpcoming: () =>
    set((s) => {
      const queue = s.queue.slice(0, s.currentIndex + 1)
      const kept = new Set(queue)
      return { queue, originalQueue: s.originalQueue && s.originalQueue.filter((x) => kept.has(x)) }
    }),
  jumpTo: (index) => {
    const { queue, playId } = get()
    if (!queue[index]) return
    set({
      currentIndex: index,
      currentSong: queue[index],
      currentTime: 0,
      isPlaying: true,
      playId: playId + 1
    })
  },

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: (auto = false) => {
    // Shuffle already reordered the queue, so "next" is always the next one in it
    const { queue, currentIndex, repeatMode, playId } = get()
    if (queue.length === 0) return

    let nextIndex: number
    if (repeatMode === 'one') {
      nextIndex = currentIndex
    } else if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1
    } else if (repeatMode === 'all') {
      nextIndex = 0
    } else {
      // End of queue: stop when the last song finishes; a manual skip keeps it playing
      if (auto) set({ isPlaying: false })
      return
    }

    set({
      currentIndex: nextIndex,
      currentSong: queue[nextIndex],
      currentTime: 0,
      isPlaying: true,
      playId: playId + 1
    })
  },

  previous: () => {
    const { queue, currentIndex, currentTime, playId } = get()
    if (queue.length === 0) return

    // If more than 3s in, restart current song
    if (currentTime > 3) {
      set({ seekToTarget: 0 })
      return
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0
    set({
      currentIndex: prevIndex,
      currentSong: queue[prevIndex],
      currentTime: 0,
      isPlaying: true,
      playId: playId + 1
    })
  },

  playNext: (song) => get().playNextMany([song]),

  seekTo: (seconds) => set({ seekToTarget: seconds }),
  clearSeekToTarget: () => set({ seekToTarget: null }),
  setVolume: (vol) => set({ volume: Math.max(0, Math.min(1, vol)), isMuted: false }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleShuffle: () =>
    set((s) => {
      const current = s.queue[s.currentIndex]
      if (!s.isShuffle) {
        // Shuffle once: only what comes after the current song; what already played stays
        return {
          isShuffle: true,
          originalQueue: s.queue,
          queue: [
            ...s.queue.slice(0, s.currentIndex + 1),
            ...shuffled(s.queue.slice(s.currentIndex + 1))
          ]
        }
      }
      const queue = s.originalQueue ? restoreOrder(s.originalQueue, s.queue) : s.queue
      return {
        isShuffle: false,
        originalQueue: null,
        queue,
        currentIndex: current ? Math.max(0, queue.indexOf(current)) : 0
      }
    }),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none'
    })),

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setIsPlaying: (v) => set({ isPlaying: v }),
  updateSongMetadata: (song) => {
    set((s) => {
      // Replace each object once and reuse it in the queue, the original order and currentSong,
      // because shuffle matches songs by object
      const swapped = new Map<Song, Song>()
      const swap = (x: Song) => {
        if (x.id !== song.id) return x
        if (!swapped.has(x)) swapped.set(x, { ...x, ...song })
        return swapped.get(x)!
      }
      const queue = s.queue.map(swap)
      const updates: Partial<PlayerState> = {
        queue,
        originalQueue: s.originalQueue && s.originalQueue.map(swap)
      }
      if (s.currentSong?.id === song.id) {
        updates.currentSong = queue[s.currentIndex] ?? { ...s.currentSong, ...song }
      }
      return updates
    })
  }
}))
