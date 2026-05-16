import { create } from 'zustand'
import type { DownloadItem } from '../../shared/download.types'
import type { DownloadProgress } from '../../shared/download.types'

interface DownloadStore {
  queue: Map<string, DownloadItem>
  activeCount: number

  // Actions
  setQueue: (items: DownloadItem[]) => void
  updateProgress: (progress: DownloadProgress) => void
  removeItem: (id: string) => void
  clearCompleted: () => void
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  queue: new Map(),
  activeCount: 0,

  setQueue: (items) => {
    const map = new Map<string, DownloadItem>()
    for (const item of items) map.set(item.id, item)
    set({
      queue: map,
      activeCount: items.filter((i) => i.status === 'downloading' || i.status === 'converting').length,
    })
  },

  updateProgress: (progress) => {
    set((s) => {
      const existing = s.queue.get(progress.downloadId)
      const updated: DownloadItem = {
        ...(existing ?? {
          id: progress.downloadId,
          url: '',
          isPlaylist: false,
          playlistTotal: progress.playlistTotal,
          playlistDone: progress.playlistDone,
          songId: null,
          playlistId: null,
          error: null,
          addedAt: Date.now(),
        }),
        title: progress.title,
        thumbnail: progress.thumbnail,
        uploader: progress.uploader,
        status: progress.status,
        progress: progress.progress,
        speed: progress.speed,
        eta: progress.eta,
        playlistTotal: progress.playlistTotal,
        playlistDone: progress.playlistDone,
      }
      const newMap = new Map(s.queue)
      newMap.set(progress.downloadId, updated)
      const activeCount = Array.from(newMap.values()).filter(
        (i) => i.status === 'downloading' || i.status === 'converting' || i.status === 'fetching_info'
      ).length
      return { queue: newMap, activeCount }
    })
  },

  removeItem: (id) => {
    set((s) => {
      const newMap = new Map(s.queue)
      newMap.delete(id)
      return { queue: newMap }
    })
  },

  clearCompleted: () => {
    set((s) => {
      const newMap = new Map(s.queue)
      for (const [id, item] of newMap) {
        if (['completed', 'failed', 'cancelled'].includes(item.status)) {
          newMap.delete(id)
        }
      }
      return { queue: newMap }
    })
  },
}))
