import { create } from 'zustand'
import type { Song } from '../../shared/types'

type RepeatMode = 'none' | 'one' | 'all'

interface PlayerState {
  // Queue
  queue: Song[]
  currentIndex: number
  // Playback state
  isPlaying: boolean
  isShuffle: boolean
  repeatMode: RepeatMode
  volume: number           // 0–1
  isMuted: boolean
  currentTime: number      // seconds
  duration: number         // seconds
  // Derived
  currentSong: Song | null
  seekToTarget: number | null

  // Queue actions
  setQueue: (songs: Song[], startIndex?: number) => void
  addToQueue: (song: Song) => void
  removeFromQueue: (index: number) => void
  removeBySongId: (id: string) => void
  clearQueue: () => void

  // Playback controls
  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
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

  setQueue: (songs, startIndex = 0) => {
    set({
      queue: songs,
      currentIndex: startIndex,
      currentSong: songs[startIndex] ?? null,
      isPlaying: songs.length > 0,
      currentTime: 0,
    })
  },

  addToQueue: (song) => {
    set((s) => ({ queue: [...s.queue, song] }))
  },

  removeFromQueue: (index) => {
    set((s) => {
      const newQueue = s.queue.filter((_, i) => i !== index)
      const newIndex = index < s.currentIndex
        ? s.currentIndex - 1
        : Math.min(s.currentIndex, newQueue.length - 1)
      return {
        queue: newQueue,
        currentIndex: newIndex,
        currentSong: newQueue[newIndex] ?? null,
      }
    })
  },

  removeBySongId: (id) => {
    set((s) => {
      const isCurrent = s.currentSong?.id === id
      const newQueue = s.queue.filter(song => song.id !== id)
      
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
        let newIndex = newQueue.findIndex(song => song.id === s.currentSong?.id)
        if (newIndex === -1) newIndex = 0 // Fallback
        return {
          queue: newQueue,
          currentIndex: newIndex
        }
      }
    })
  },

  clearQueue: () => set({ queue: [], currentIndex: 0, currentSong: null, isPlaying: false }),

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

  next: () => {
    const { queue, currentIndex, isShuffle, repeatMode } = get()
    if (queue.length === 0) return

    let nextIndex: number
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length)
    } else if (currentIndex < queue.length - 1) {
      nextIndex = currentIndex + 1
    } else if (repeatMode === 'all') {
      nextIndex = 0
    } else {
      // End of queue
      set({ isPlaying: false })
      return
    }

    set({ currentIndex: nextIndex, currentSong: queue[nextIndex], currentTime: 0, isPlaying: true })
  },

  previous: () => {
    const { queue, currentIndex, currentTime } = get()
    if (queue.length === 0) return

    // If more than 3s in, restart current song
    if (currentTime > 3) {
      set({ seekToTarget: 0 })
      return
    }

    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0
    set({ currentIndex: prevIndex, currentSong: queue[prevIndex], currentTime: 0, isPlaying: true })
  },

  playNext: (song) => {
    set((s) => {
      if (s.queue.length === 0) {
        return { queue: [song], currentIndex: 0, currentSong: song, isPlaying: true, currentTime: 0 }
      }
      const newQueue = [...s.queue]
      newQueue.splice(s.currentIndex + 1, 0, song)
      return { queue: newQueue }
    })
  },

  seekTo: (seconds) => set({ seekToTarget: seconds }),
  clearSeekToTarget: () => set({ seekToTarget: null }),
  setVolume: (vol) => set({ volume: Math.max(0, Math.min(1, vol)), isMuted: false }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
  cycleRepeat: () =>
    set((s) => ({
      repeatMode: s.repeatMode === 'none' ? 'all' : s.repeatMode === 'all' ? 'one' : 'none',
    })),

  setCurrentTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setIsPlaying: (v) => set({ isPlaying: v }),
}))
