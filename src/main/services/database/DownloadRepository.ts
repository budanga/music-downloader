import { getDatabase } from './Database'
import type { DownloadItem } from '../../../shared/download.types'

export function upsertDownload(item: DownloadItem): void {
  const db = getDatabase()
  db.prepare(`
    INSERT INTO download_history (
      id, url, title, status, error, song_id, timestamp,
      thumbnail, uploader, playlist_id, is_playlist,
      playlist_total, playlist_done, track_number
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      status = excluded.status,
      error = excluded.error,
      song_id = excluded.song_id,
      playlist_done = excluded.playlist_done,
      title = excluded.title,
      thumbnail = excluded.thumbnail,
      uploader = excluded.uploader
  `).run(
    item.id,
    item.url,
    item.title,
    item.status,
    item.error,
    item.songId,
    item.addedAt || Date.now(),
    item.thumbnail,
    item.uploader,
    item.playlistId,
    item.isPlaylist ? 1 : 0,
    item.playlistTotal,
    item.playlistDone,
    item.trackNumber
  )
}

export function getAllDownloads(): DownloadItem[] {
  const db = getDatabase()
  const rows = db.prepare(`SELECT * FROM download_history ORDER BY timestamp DESC`).all() as any[]
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    title: r.title,
    status: r.status as any,
    error: r.error,
    songId: r.song_id,
    addedAt: r.timestamp,
    thumbnail: r.thumbnail,
    uploader: r.uploader,
    playlistId: r.playlist_id,
    isPlaylist: Boolean(r.is_playlist),
    playlistTotal: r.playlist_total,
    playlistDone: r.playlist_done,
    trackNumber: r.track_number,
    progress: r.status === 'completed' ? 100 : 0,
    speed: null,
    eta: null
  }))
}

export function deleteDownload(id: string): void {
  const db = getDatabase()
  db.prepare(`DELETE FROM download_history WHERE id = ?`).run(id)
}

export function clearCompletedDownloads(): void {
  const db = getDatabase()
  db.prepare(`DELETE FROM download_history WHERE status = 'completed'`).run()
}
