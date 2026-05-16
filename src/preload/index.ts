import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc.channels'
import type { LibraryFilters, LibrarySort, AppSettings } from '../shared/types'
import type { DownloadRequest, DownloadProgress } from '../shared/download.types'

/**
 * Typed API exposed to the renderer via contextBridge.
 * The renderer never calls ipcRenderer directly.
 */
const api = {
  // ─── Library ──────────────────────────────────────────────────────────────
  library: {
    getSongs: (filters?: LibraryFilters, sort?: LibrarySort) =>
      ipcRenderer.invoke(IPC.LIBRARY_GET_SONGS, filters, sort),
    getArtists: () => ipcRenderer.invoke(IPC.LIBRARY_GET_ARTISTS),
    getAlbums: () => ipcRenderer.invoke(IPC.LIBRARY_GET_ALBUMS),
    search: (query: string) => ipcRenderer.invoke(IPC.LIBRARY_SEARCH, query),
    getSong: (id: string) => ipcRenderer.invoke(IPC.LIBRARY_GET_SONG, id),
    updateSong: (id: string, updates: object) => ipcRenderer.invoke(IPC.LIBRARY_UPDATE_SONG, id, updates),
    deleteSong: (id: string, deleteFile?: boolean) => ipcRenderer.invoke(IPC.LIBRARY_DELETE_SONG, id, deleteFile),
    toggleFavorite: (id: string) => ipcRenderer.invoke(IPC.LIBRARY_TOGGLE_FAVORITE, id),
    incrementPlayCount: (id: string) => ipcRenderer.invoke(IPC.LIBRARY_INCREMENT_PLAY_COUNT, id),
    getRecentlyPlayed: (limit?: number) => ipcRenderer.invoke(IPC.LIBRARY_GET_RECENTLY_PLAYED, limit),
    getMostPlayed: (limit?: number) => ipcRenderer.invoke(IPC.LIBRARY_GET_MOST_PLAYED, limit),
    scanFolder: () => ipcRenderer.invoke(IPC.LIBRARY_SCAN_FOLDER),
  },

  // ─── Playlists ────────────────────────────────────────────────────────────
  playlists: {
    list: () => ipcRenderer.invoke(IPC.PLAYLIST_LIST),
    get: (id: string) => ipcRenderer.invoke(IPC.PLAYLIST_GET, id),
    create: (name: string, description?: string) => ipcRenderer.invoke(IPC.PLAYLIST_CREATE, name, description),
    update: (id: string, updates: object) => ipcRenderer.invoke(IPC.PLAYLIST_UPDATE, id, updates),
    delete: (id: string) => ipcRenderer.invoke(IPC.PLAYLIST_DELETE, id),
    getSongs: (playlistId: string) => ipcRenderer.invoke(IPC.PLAYLIST_GET_SONGS, playlistId),
    addSong: (playlistId: string, songId: string) => ipcRenderer.invoke(IPC.PLAYLIST_ADD_SONG, playlistId, songId),
    removeSong: (playlistId: string, songId: string) => ipcRenderer.invoke(IPC.PLAYLIST_REMOVE_SONG, playlistId, songId),
    reorder: (playlistId: string, songId: string, newPosition: number) =>
      ipcRenderer.invoke(IPC.PLAYLIST_REORDER, playlistId, songId, newPosition),
  },

  // ─── Downloads ────────────────────────────────────────────────────────────
  downloads: {
    start: (request: DownloadRequest) => ipcRenderer.invoke(IPC.DOWNLOAD_START, request),
    pause: (id?: string) => ipcRenderer.invoke(IPC.DOWNLOAD_PAUSE, id),
    resume: (id?: string) => ipcRenderer.invoke(IPC.DOWNLOAD_RESUME, id),
    cancel: (id: string) => ipcRenderer.invoke(IPC.DOWNLOAD_CANCEL, id),
    retry: (id: string) => ipcRenderer.invoke(IPC.DOWNLOAD_RETRY, id),
    getQueue: () => ipcRenderer.invoke(IPC.DOWNLOAD_GET_QUEUE),
    clearCompleted: () => ipcRenderer.invoke(IPC.DOWNLOAD_CLEAR_COMPLETED),
    getHistory: () => ipcRenderer.invoke(IPC.DOWNLOAD_GET_HISTORY),
  },

  // ─── Settings ─────────────────────────────────────────────────────────────
  settings: {
    getAll: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET_ALL),
    get: (key: keyof AppSettings) => ipcRenderer.invoke(IPC.SETTINGS_GET, key),
    set: (key: keyof AppSettings, value: unknown) => ipcRenderer.invoke(IPC.SETTINGS_SET, key, value),
  },

  // ─── System ───────────────────────────────────────────────────────────────
  system: {
    openFile: (filePath: string) => ipcRenderer.invoke(IPC.SYSTEM_OPEN_FILE, filePath),
    showInFolder: (filePath: string) => ipcRenderer.invoke(IPC.SYSTEM_SHOW_IN_FOLDER, filePath),
    chooseDirectory: () => ipcRenderer.invoke(IPC.SYSTEM_CHOOSE_DIRECTORY),
    chooseFile: () => ipcRenderer.invoke(IPC.SYSTEM_CHOOSE_FILE),
    checkYtdlp: () => ipcRenderer.invoke(IPC.SYSTEM_CHECK_YTDLP),
    updateYtdlp: () => ipcRenderer.invoke(IPC.SYSTEM_UPDATE_YTDLP),
    getDefaultDownloadPath: () => ipcRenderer.invoke(IPC.SYSTEM_GET_DEFAULT_DOWNLOAD_PATH),
    minimizeWindow: () => ipcRenderer.invoke(IPC.SYSTEM_MINIMIZE_WINDOW),
    maximizeWindow: () => ipcRenderer.invoke(IPC.SYSTEM_MAXIMIZE_WINDOW),
    closeWindow: () => ipcRenderer.invoke(IPC.SYSTEM_CLOSE_WINDOW),
  },

  // ─── Events (main → renderer) ─────────────────────────────────────────────
  on: {
    downloadProgress: (cb: (progress: DownloadProgress) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: DownloadProgress) => cb(data)
      ipcRenderer.on(IPC.DOWNLOAD_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.DOWNLOAD_PROGRESS, handler)
    },
    downloadCompleted: (cb: (data: { downloadId: string; song: object }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: object) => cb(data as never)
      ipcRenderer.on(IPC.DOWNLOAD_COMPLETED, handler)
      return () => ipcRenderer.removeListener(IPC.DOWNLOAD_COMPLETED, handler)
    },
    downloadFailed: (cb: (data: { downloadId: string; error: string }) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, data: object) => cb(data as never)
      ipcRenderer.on(IPC.DOWNLOAD_FAILED, handler)
      return () => ipcRenderer.removeListener(IPC.DOWNLOAD_FAILED, handler)
    },
    librarySongAdded: (cb: (song: object) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, song: object) => cb(song)
      ipcRenderer.on(IPC.LIBRARY_SONG_ADDED, handler)
      return () => ipcRenderer.removeListener(IPC.LIBRARY_SONG_ADDED, handler)
    },
    librarySongDeleted: (cb: (id: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on(IPC.LIBRARY_SONG_DELETED, handler)
      return () => ipcRenderer.removeListener(IPC.LIBRARY_SONG_DELETED, handler)
    },
    libraryPlaylistAdded: (cb: (playlist: object) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, playlist: object) => cb(playlist)
      ipcRenderer.on(IPC.LIBRARY_PLAYLIST_ADDED, handler)
      return () => ipcRenderer.removeListener(IPC.LIBRARY_PLAYLIST_ADDED, handler)
    },
    libraryPlaylistDeleted: (cb: (id: string) => void) => {
      const handler = (_e: Electron.IpcRendererEvent, id: string) => cb(id)
      ipcRenderer.on(IPC.LIBRARY_PLAYLIST_DELETED, handler)
      return () => ipcRenderer.removeListener(IPC.LIBRARY_PLAYLIST_DELETED, handler)
    },
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
