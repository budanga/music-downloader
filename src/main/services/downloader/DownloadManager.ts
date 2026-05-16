import EventEmitter from 'events'
import { uuidv4 } from '../../utils/uuid'
import path from 'path'
import fs from 'fs'
import { BrowserWindow } from 'electron'
import { YtDlpWrapper } from './YtDlpWrapper'
import { getAllSettings } from '../database/SettingsRepository'
import { insertSong, getSongByYtId, upsertArtist, upsertAlbum } from '../database/SongRepository'
import { addSongToPlaylist, createPlaylist } from '../database/PlaylistRepository'
import { IPC } from '../../../shared/ipc.channels'
import type { DownloadItem, DownloadProgress, DownloadRequest, YtDlpMetadata } from '../../../shared/download.types'
import type { Song } from '../../../shared/types'

/**
 * Download Manager — manages a concurrent download queue.
 * Emits IPC events to the renderer for live progress updates.
 */
export class DownloadManager extends EventEmitter {
  private queue: Map<string, DownloadItem> = new Map()
  private active: Set<string> = new Set()
  private processes: Map<string, ReturnType<YtDlpWrapper['download']>['process']> = new Map()
  private abortControllers: Map<string, AbortController> = new Map()
  private mainWindow: BrowserWindow | null = null
  private isPausedAll = false

  constructor() {
    super()
  }

  setMainWindow(win: BrowserWindow): void {
    this.mainWindow = win
  }

  private send(channel: string, data: unknown): void {
    this.mainWindow?.webContents?.send(channel, data)
  }

  // ─── Queue Management ─────────────────────────────────────────────────────

  getQueue(): DownloadItem[] {
    return Array.from(this.queue.values())
  }

  clearCompleted(): void {
    for (const [id, item] of this.queue.entries()) {
      if (item.status === 'completed' || item.status === 'cancelled' || item.status === 'failed') {
        this.queue.delete(id)
      }
    }
  }

  // ─── Download Entry Points ─────────────────────────────────────────────────

  async enqueue(request: DownloadRequest): Promise<string[]> {
    const settings = getAllSettings()
    const ytdlp = new YtDlpWrapper(settings.ytdlpPath, settings.ffmpegPath)

    const isPlaylist = YtDlpWrapper.isPlaylistUrl(request.url)
    const ids: string[] = []

    if (isPlaylist) {
      // For playlists, we enqueue one item per track
      const id = uuidv4()
      const item: DownloadItem = {
        id,
        url: request.url,
        title: 'Fetching playlist info…',
        thumbnail: null,
        uploader: null,
        status: 'fetching_info',
        progress: 0,
        speed: null,
        eta: null,
        error: null,
        songId: null,
        playlistId: request.playlistId ?? null,
        isPlaylist: true,
        playlistTotal: 0,
        playlistDone: 0,
        addedAt: Date.now(),
      }
      this.queue.set(id, item)
      ids.push(id)
      this.sendProgress(item)
      const abortController = new AbortController()
      this.abortControllers.set(id, abortController)
      this.processPlaylist(id, request, ytdlp, settings, abortController.signal).catch((e) => this.markFailed(id, String(e)))
    } else {
      const id = uuidv4()
      const item: DownloadItem = {
        id,
        url: request.url,
        title: 'Fetching info…',
        thumbnail: null,
        uploader: null,
        status: this.isPausedAll ? 'paused' : 'queued',
        progress: 0,
        speed: null,
        eta: null,
        error: null,
        songId: null,
        playlistId: request.playlistId ?? null,
        isPlaylist: false,
        playlistTotal: 1,
        playlistDone: 0,
        addedAt: Date.now(),
      }
      this.queue.set(id, item)
      ids.push(id)
      this.sendProgress(item)
      this.scheduleNext()
    }

    return ids
  }

  private async processPlaylist(
    masterId: string,
    request: DownloadRequest,
    ytdlp: YtDlpWrapper,
    settings: ReturnType<typeof getAllSettings>,
    signal?: AbortSignal
  ): Promise<void> {
    let entries: YtDlpMetadata[]
    console.log(`[DEBUG] processPlaylist started for ${request.url}`)
    try {
      entries = await ytdlp.getPlaylistMetadata(request.url, signal)
      this.abortControllers.delete(masterId)
      console.log(`[DEBUG] processPlaylist got ${entries.length} entries`)
    } catch (e) {
      console.error('[DEBUG] [DownloadManager] Error in getPlaylistMetadata:', e)
      this.markFailed(masterId, String(e))
      return
    }

    const master = this.queue.get(masterId)!
    master.playlistTotal = entries.length
    master.title = `Playlist (${entries.length} tracks)`

    let playlistId = request.playlistId
    if (!playlistId && entries.length > 0) {
      try {
        const title = entries[0].playlist_title || entries[0].album || 'Nueva Playlist'
        console.log(`[DEBUG] processPlaylist creating new playlist with title: ${title}`)
        const newPlaylist = createPlaylist(title, undefined, entries[0].thumbnail)
        playlistId = newPlaylist.id
        console.log(`[DEBUG] processPlaylist created playlist ID: ${playlistId}`)
        this.send(IPC.LIBRARY_PLAYLIST_ADDED, newPlaylist)
      } catch (dbErr) {
        console.error('[DEBUG] processPlaylist database error creating playlist:', dbErr)
        // We can continue without a playlistId if needed, or fail. Let's fail for now to see the error.
        throw dbErr
      }
    }

    console.log(`[DEBUG] processPlaylist enqueuing ${entries.length} tracks...`)
    // Enqueue each track individually
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const id = uuidv4()
      const url = entry.webpage_url || entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : '')
      if (i === 0) console.log(`[DEBUG] processPlaylist first entry url: ${url}`, entry)
      const item: DownloadItem = {
        id,
        url,
        title: entry.title,
        thumbnail: entry.thumbnail ?? null,
        uploader: entry.uploader ?? null,
        status: this.isPausedAll ? 'paused' : 'queued',
        progress: 0,
        speed: null,
        eta: null,
        error: null,
        songId: null,
        playlistId,
        isPlaylist: false,
        playlistTotal: 1,
        playlistDone: 0,
        addedAt: Date.now(),
        trackNumber: i + 1,
      }
      this.queue.set(id, item)
    }

    // Mark the master placeholder as completed instead of just deleting it
    master.status = 'completed'
    master.progress = 100
    this.sendProgress(master)
    this.queue.delete(masterId)
    this.scheduleNext()
  }

  private scheduleNext(): void {
    const settings = getAllSettings()
    let maxConcurrent = settings.maxConcurrentDownloads ?? 2
    if (maxConcurrent === 0) maxConcurrent = 15

    if (this.active.size < maxConcurrent) {
      const next = Array.from(this.queue.values()).find((i) => i.status === 'queued')
      if (next) {
        this.startDownload(next.id).catch(err => {
          console.error(`[DEBUG] Error in startDownload for ${next.id}:`, err)
        })
        // Stagger the next check slightly to avoid burst requests
        setTimeout(() => this.scheduleNext(), 500)
      }
    }
  }

  private async startDownload(id: string): Promise<void> {
    const item = this.queue.get(id)
    if (!item) return
    if (!item.url) {
      this.markFailed(id, 'Invalid or missing URL for this track')
      return
    }

    this.active.add(id)
    item.status = 'fetching_info'
    this.sendProgress(item)

    console.log(`[DEBUG] startDownload fetching metadata for ${item.url}`)
    const settings = getAllSettings()
    const ytdlp = new YtDlpWrapper(settings.ytdlpPath, settings.ffmpegPath)

    // Check for duplicates
    try {
      // Allow cancellation during metadata fetch
      const abortController = new AbortController()
      this.abortControllers.set(id, abortController)
      
      // We need to modify YtDlpWrapper to support AbortController or just check status after
      const meta = await ytdlp.getMetadata(item.url, abortController.signal)
      this.abortControllers.delete(id)
      
      // Check if it was cancelled while we were awaiting
      if (item.status === 'cancelled' || item.status === 'paused') {
        this.active.delete(id)
        return
      }

      item.title = meta.title
      item.thumbnail = meta.thumbnail ?? null
      item.uploader = meta.uploader

      // Check duplicate by yt_id
      const existing = getSongByYtId(meta.id)
      if (existing) {
        this.markCompleted(id, existing)
        return
      }

      item.status = 'downloading'
      this.sendProgress(item)

      const downloadPath = settings.downloadPath || path.join(process.env.USERPROFILE || '', 'Downloads', 'Music')
      const tempPath = path.join(downloadPath, `.temp_${id}`)
      if (!fs.existsSync(tempPath)) fs.mkdirSync(tempPath, { recursive: true })

      const format = settings.audioFormat

      const { process: proc, getOutputPath } = ytdlp.download({
        url: item.url,
        outputDir: tempPath,
        format,
        quality: settings.audioQuality,
        ffmpegPath: settings.ffmpegPath,
        onProgress: (progress, speed, eta) => {
          item.progress = progress
          item.speed = speed
          item.eta = eta
          item.status = progress >= 100 ? 'converting' : 'downloading'
          this.sendProgress(item)
        },
      })

      this.processes.set(id, proc)

      await new Promise<void>((resolve, reject) => {
        proc.on('close', (code) => {
          if (code === 0 || code === null) resolve()
          else reject(new Error(`yt-dlp exited with code ${code}`))
        })
        proc.on('error', reject)
      })

      // Find the downloaded file in the temp directory
      const files = fs.readdirSync(tempPath).filter(f => !f.startsWith('.'))
      if (files.length === 0) {
        throw new Error('Output file not found in temp directory after download')
      }
      const outputPath = path.join(tempPath, files[0])
      console.log(`[DEBUG] Found output file: ${outputPath}`)

      item.status = 'embedding_metadata'
      this.sendProgress(item)

      // Get file size
      const stat = fs.statSync(outputPath)

      // Upsert artist & album
      let trackArtistName = meta.artist ?? meta.uploader ?? 'Unknown Artist'
      let albumArtistName = meta.album_artist
      
      // If we don't have an explicit album_artist, infer it by removing "feat." etc.
      if (!albumArtistName) {
        albumArtistName = trackArtistName.split(/\s+feat\.|\s+ft\.|\s+featuring\s+|,\s*|\s*&\s*|\s+x\s+|\s+with\s+/i)[0].trim()
        if (!albumArtistName) albumArtistName = trackArtistName
      }

      // To avoid creating dozens of artists for collaborations, we just assign the song to the main artist.
      trackArtistName = albumArtistName
      
      const trackArtistId = trackArtistName ? upsertArtist(trackArtistName, meta.thumbnail) : null
      const albumArtistId = albumArtistName ? upsertArtist(albumArtistName, meta.thumbnail) : null
      
      const albumId = meta.album && albumArtistId
        ? upsertAlbum(meta.album, albumArtistId, meta.release_year ?? null, meta.thumbnail ?? null)
        : null

      // Final destination path
      const finalDir = path.join(downloadPath, sanitizeName(trackArtistName), sanitizeName(meta.album || 'Unknown Album'))
      if (!fs.existsSync(finalDir)) fs.mkdirSync(finalDir, { recursive: true })
      
      const finalPath = path.join(finalDir, path.basename(outputPath))
      console.log(`[DEBUG] Moving file from ${outputPath} to ${finalPath}`)
      
      // Move file
      try {
        fs.renameSync(outputPath, finalPath)
      } catch (err) {
        fs.copyFileSync(outputPath, finalPath)
        fs.unlinkSync(outputPath)
      }
      
      // Clean up temp folder
      try {
        fs.rmSync(tempPath, { recursive: true, force: true })
      } catch { /* ignore */ }

      // Save song to DB
      const song = insertSong({
        ytId: meta.id,
        title: meta.title,
        artistId: trackArtistId,
        albumId,
        duration: meta.duration ?? 0,
        filePath: finalPath,
        thumbnail: meta.thumbnail ?? null,
        trackNumber: item.trackNumber ?? meta.track_number ?? null,
        genre: meta.genre ?? null,
        year: meta.release_year ?? null,
        bitrate: null,
        format,
        fileSize: stat.size,
      })

      // Add to playlist if specified
      if (item.playlistId) {
        try {
          addSongToPlaylist(item.playlistId, song.id)
        } catch { /* ignore */ }
      }

      this.markCompleted(id, song)
    } catch (e: any) {
      const item = this.queue.get(id)
      const isIntentional = e.message === 'Aborted' && (item?.status === 'paused' || item?.status === 'cancelled')
      
      if (!isIntentional) {
        console.error(`[DEBUG] [DownloadManager] Error during download for ${item?.url || id}:`, e)
      }
      this.markFailed(id, e.message || String(e))
    }
  }

  private markCompleted(id: string, song: Song): void {
    const item = this.queue.get(id)
    if (!item || item.status === 'cancelled' || item.status === 'paused') {
      this.active.delete(id)
      this.processes.delete(id)
      return
    }
    item.status = 'completed'
    item.progress = 100
    item.songId = song.id
    item.speed = null
    item.eta = null
    this.active.delete(id)
    this.processes.delete(id)
    this.sendProgress(item)
    this.send(IPC.DOWNLOAD_COMPLETED, { downloadId: id, song })
    this.send(IPC.LIBRARY_SONG_ADDED, song)
    this.scheduleNext()
  }

  private markFailed(id: string, error: string): void {
    const item = this.queue.get(id)
    if (!item || item.status === 'cancelled' || item.status === 'paused') {
      this.active.delete(id)
      this.processes.delete(id)
      return
    }
    item.status = 'failed'
    item.error = error
    this.active.delete(id)
    this.processes.delete(id)
    this.sendProgress(item)
    this.send(IPC.DOWNLOAD_FAILED, { downloadId: id, error })
    this.scheduleNext()
  }

  cancel(id: string): void {
    const proc = this.processes.get(id)
    if (proc) {
      try {
        // On Windows, sometimes we need to be more aggressive or use different methods
        // but for now let's try standard kill. 
        proc.kill('SIGTERM')
      } catch (e) {
        console.error(`[DEBUG] Failed to kill process for ${id}:`, e)
      }
      this.processes.delete(id)
    }
    
    // Also cancel pending metadata fetch
    const abort = this.abortControllers.get(id)
    if (abort) {
      abort.abort()
      this.abortControllers.delete(id)
    }

    const item = this.queue.get(id)
    if (item) {
      item.status = 'cancelled'
      this.sendProgress(item)
    }
    this.active.delete(id)
    this.scheduleNext()
  }

  pause(id: string): void {
    const item = this.queue.get(id)
    if (!item || !['downloading', 'fetching_info', 'queued'].includes(item.status)) return

    const proc = this.processes.get(id)
    if (proc) {
      proc.kill('SIGTERM')
      this.processes.delete(id)
    }

    const abort = this.abortControllers.get(id)
    if (abort) {
      abort.abort()
      this.abortControllers.delete(id)
    }

    item.status = 'paused'
    item.speed = null
    item.eta = null
    this.active.delete(id)
    this.sendProgress(item)
    this.scheduleNext()
  }

  resume(id: string): void {
    const item = this.queue.get(id)
    if (!item || item.status !== 'paused') return

    item.status = 'queued'
    this.sendProgress(item)
    this.scheduleNext()
  }

  pauseAll(): void {
    this.isPausedAll = true
    for (const item of this.queue.values()) {
      if (['downloading', 'fetching_info', 'queued'].includes(item.status)) {
        this.pause(item.id)
      }
    }
  }

  resumeAll(): void {
    this.isPausedAll = false
    for (const item of this.queue.values()) {
      if (item.status === 'paused') {
        item.status = 'queued'
      }
    }
    this.scheduleNext()
  }

  retry(id: string): void {
    const item = this.queue.get(id)
    if (!item) return

    if (item.isPlaylist || YtDlpWrapper.isPlaylistUrl(item.url)) {
      item.status = 'fetching_info'
      item.error = null
      item.progress = 0
      this.sendProgress(item)
      const settings = getAllSettings()
      const ytdlp = new YtDlpWrapper(settings.ytdlpPath, settings.ffmpegPath)
      this.processPlaylist(id, { url: item.url, playlistId: item.playlistId ?? undefined }, ytdlp, settings)
        .catch((e) => this.markFailed(id, String(e)))
      return
    }

    item.status = 'queued'
    item.error = null
    item.progress = 0
    this.sendProgress(item)
    this.scheduleNext()
  }

  private sendProgress(item: DownloadItem): void {
    const progress: DownloadProgress = {
      downloadId: item.id,
      status: item.status,
      progress: item.progress,
      speed: item.speed,
      eta: item.eta,
      title: item.title,
      thumbnail: item.thumbnail,
      uploader: item.uploader,
      playlistTotal: item.playlistTotal,
      playlistDone: item.playlistDone,
      trackNumber: item.trackNumber,
    }
    this.send(IPC.DOWNLOAD_PROGRESS, progress)
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*]/g, '').trim() || 'Unknown'
}

// Singleton
export const downloadManager = new DownloadManager()
