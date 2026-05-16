import { ipcMain, dialog, shell } from 'electron'
import { IPC } from '../../../shared/ipc.channels'
import { getAllSongs, getSongById, updateSong, deleteSong, incrementPlayCount, getRecentlyPlayed, getMostPlayed, searchSongs, getAllArtists, getAllAlbums, deleteArtist, deleteAlbum, cleanupLibrary } from '../services/database/SongRepository'
import { getAllPlaylists, getPlaylistById, createPlaylist, updatePlaylist, deletePlaylist, getPlaylistSongs, addSongToPlaylist, removeSongFromPlaylist, reorderPlaylistSong } from '../services/database/PlaylistRepository'
import { getSetting, setSetting, getAllSettings } from '../services/database/SettingsRepository'
import { downloadManager } from '../services/downloader/DownloadManager'
import { YtDlpWrapper } from '../services/downloader/YtDlpWrapper'
import type { LibraryFilters, LibrarySort } from '../../../shared/types'
import type { DownloadRequest } from '../../../shared/download.types'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { SPECIAL_PLAYLISTS } from '../../../shared/constants'

export function registerAllIpcHandlers(): void {
  registerLibraryHandlers()
  registerPlaylistHandlers()
  registerDownloadHandlers()
  registerSettingsHandlers()
  registerSystemHandlers()
}

// ─── Library ──────────────────────────────────────────────────────────────────

function registerLibraryHandlers(): void {
  ipcMain.handle(IPC.LIBRARY_GET_SONGS, (_e, filters?: LibraryFilters, sort?: LibrarySort) => {
    return getAllSongs(filters, sort)
  })

  ipcMain.handle(IPC.LIBRARY_GET_ARTISTS, () => getAllArtists())
  ipcMain.handle(IPC.LIBRARY_GET_ALBUMS, () => getAllAlbums())

  ipcMain.handle(IPC.LIBRARY_SEARCH, (_e, query: string) => searchSongs(query))

  ipcMain.handle(IPC.LIBRARY_GET_SONG, (_e, id: string) => getSongById(id))

  ipcMain.handle(IPC.LIBRARY_UPDATE_SONG, (_e, id: string, updates: Parameters<typeof updateSong>[1]) => {
    updateSong(id, updates)
    return getSongById(id)
  })

  ipcMain.handle(IPC.LIBRARY_DELETE_SONG, (_e, id: string, deleteFile = false) => {
    const song = getSongById(id)
    if (deleteFile && song?.filePath && fs.existsSync(song.filePath)) {
      fs.unlinkSync(song.filePath)
    }
    deleteSong(id)
    return { success: true }
  })

  ipcMain.handle(IPC.LIBRARY_DELETE_ARTIST, (_e, id: string) => {
    deleteArtist(id)
    return { success: true }
  })

  ipcMain.handle(IPC.LIBRARY_DELETE_ALBUM, (_e, id: string) => {
    deleteAlbum(id)
    return { success: true }
  })

  ipcMain.handle(IPC.LIBRARY_CLEANUP, () => {
    cleanupLibrary()
    return { success: true }
  })

  ipcMain.handle(IPC.LIBRARY_TOGGLE_FAVORITE, (_e, id: string) => {
    const song = getSongById(id)
    if (!song) return null
    
    const newStatus = !song.isFavorite
    updateSong(id, { isFavorite: newStatus })
    
    if (newStatus) {
      addSongToPlaylist(SPECIAL_PLAYLISTS.LIKED_SONGS, id)
    } else {
      removeSongFromPlaylist(SPECIAL_PLAYLISTS.LIKED_SONGS, id)
    }
    
    const updated = getSongById(id)
    if (updated) {
      _e.sender.send(IPC.LIBRARY_SONG_UPDATED, updated)
    }
    return updated
  })

  ipcMain.handle(IPC.LIBRARY_INCREMENT_PLAY_COUNT, (_e, id: string) => {
    incrementPlayCount(id)
  })

  ipcMain.handle(IPC.LIBRARY_GET_RECENTLY_PLAYED, (_e, limit?: number) => getRecentlyPlayed(limit))
  ipcMain.handle(IPC.LIBRARY_GET_MOST_PLAYED, (_e, limit?: number) => getMostPlayed(limit))
}

// ─── Playlists ────────────────────────────────────────────────────────────────

function registerPlaylistHandlers(): void {
  ipcMain.handle(IPC.PLAYLIST_LIST, () => getAllPlaylists())
  ipcMain.handle(IPC.PLAYLIST_GET, (_e, id: string) => getPlaylistById(id))

  ipcMain.handle(IPC.PLAYLIST_CREATE, (_e, name: string, description?: string, thumbnail?: string) => {
    // Basic validation
    if (!name || name.trim().length === 0) {
      throw new Error('Playlist name is required')
    }

    // Security: Limit thumbnail size and type if provided
    if (thumbnail) {
      // Check if it's a valid data URL and not too huge (e.g. 10MB limit on base64 string)
      if (!thumbnail.startsWith('data:image/') || thumbnail.length > 15 * 1024 * 1024) {
        throw new Error('Invalid playlist thumbnail')
      }
    }

    return createPlaylist(name.trim(), description, thumbnail)
  })

  ipcMain.handle(IPC.PLAYLIST_UPDATE, (_e, id: string, updates: { name?: string; description?: string }) => {
    updatePlaylist(id, updates)
    return getPlaylistById(id)
  })

  ipcMain.handle(IPC.PLAYLIST_DELETE, (_e, id: string) => {
    deletePlaylist(id)
    return { success: true }
  })

  ipcMain.handle(IPC.PLAYLIST_GET_SONGS, (_e, playlistId: string) => getPlaylistSongs(playlistId))

  ipcMain.handle(IPC.PLAYLIST_ADD_SONG, (_e, playlistId: string, songId: string) => {
    addSongToPlaylist(playlistId, songId)
    return { success: true }
  })

  ipcMain.handle(IPC.PLAYLIST_REMOVE_SONG, (_e, playlistId: string, songId: string) => {
    removeSongFromPlaylist(playlistId, songId)
    return { success: true }
  })

  ipcMain.handle(IPC.PLAYLIST_REORDER, (_e, playlistId: string, songId: string, newPosition: number) => {
    reorderPlaylistSong(playlistId, songId, newPosition)
    return { success: true }
  })
}

// ─── Downloads ────────────────────────────────────────────────────────────────

function registerDownloadHandlers(): void {
  ipcMain.handle(IPC.DOWNLOAD_START, async (_e, request: DownloadRequest) => {
    try {
      // Server-side URL validation
      const ytRegex = /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)\/(watch\?v=|playlist\?list=|v\/|embed\/)?([a-zA-Z0-9_-]{11}|[a-zA-Z0-9_-]{34})(&.*)?$/
      if (!request.url || !ytRegex.test(request.url)) {
        return { success: false, error: 'Invalid YouTube URL' }
      }

      const ids = await downloadManager.enqueue(request)
      return { success: true, ids }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(IPC.DOWNLOAD_CANCEL, (_e, id: string) => {
    downloadManager.cancel(id)
    return { success: true }
  })
  
  ipcMain.handle(IPC.DOWNLOAD_PAUSE, (_e, id?: string) => {
    if (id) downloadManager.pause(id)
    else downloadManager.pauseAll()
    return { success: true }
  })

  ipcMain.handle(IPC.DOWNLOAD_RESUME, (_e, id?: string) => {
    if (id) downloadManager.resume(id)
    else downloadManager.resumeAll()
    return { success: true }
  })

  ipcMain.handle(IPC.DOWNLOAD_RETRY, (_e, id: string) => {
    downloadManager.retry(id)
    return { success: true }
  })

  ipcMain.handle(IPC.DOWNLOAD_GET_QUEUE, () => downloadManager.getQueue())

  ipcMain.handle(IPC.DOWNLOAD_CLEAR_COMPLETED, () => {
    downloadManager.clearCompleted()
    return { success: true }
  })
}

// ─── Settings ─────────────────────────────────────────────────────────────────

function registerSettingsHandlers(): void {
  ipcMain.handle(IPC.SETTINGS_GET_ALL, () => getAllSettings())

  ipcMain.handle(IPC.SETTINGS_GET, (_e, key: string) => getSetting(key as never))

  ipcMain.handle(IPC.SETTINGS_SET, (_e, key: string, value: unknown) => {
    setSetting(key as never, value as never)
    return { success: true }
  })
}

// ─── System ───────────────────────────────────────────────────────────────────

function registerSystemHandlers(): void {
  ipcMain.handle(IPC.SYSTEM_OPEN_FILE, (_e, filePath: string) => {
    shell.openPath(filePath)
  })

  ipcMain.handle(IPC.SYSTEM_SHOW_IN_FOLDER, (_e, filePath: string) => {
    shell.showItemInFolder(filePath)
  })

  ipcMain.handle(IPC.SYSTEM_CHOOSE_DIRECTORY, async (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.SYSTEM_CHOOSE_FILE, async (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    const result = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      filters: [{ name: 'Executable', extensions: ['exe', ''] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC.SYSTEM_CHECK_YTDLP, async () => {
    const settings = getAllSettings()
    const ytdlp = new YtDlpWrapper(settings.ytdlpPath, settings.ffmpegPath)
    try {
      const version = await ytdlp.checkAvailability()
      return { available: true, version }
    } catch (e) {
      return { available: false, error: String(e) }
    }
  })

  ipcMain.handle(IPC.SYSTEM_UPDATE_YTDLP, async () => {
    const settings = getAllSettings()
    const ytdlp = new YtDlpWrapper(settings.ytdlpPath, settings.ffmpegPath)
    try {
      const result = await ytdlp.selfUpdate()
      return { success: true, result }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle(IPC.SYSTEM_GET_DEFAULT_DOWNLOAD_PATH, () => {
    return path.join(app.getPath('music'), 'MusicDownloader')
  })

  ipcMain.handle(IPC.SYSTEM_MINIMIZE_WINDOW, (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    win?.minimize()
  })

  ipcMain.handle(IPC.SYSTEM_MAXIMIZE_WINDOW, (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.handle(IPC.SYSTEM_CLOSE_WINDOW, (e) => {
    const win = require('electron').BrowserWindow.fromWebContents(e.sender)
    win?.close()
  })
}
