import { uuidv4 } from '../../utils/uuid'
import { getDatabase } from './Database'
import type { Playlist, PlaylistSong, Song } from '../../../shared/types'

interface PlaylistRow {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  yt_id: string | null
  song_count: number
  date_created: number
  date_modified: number
}

interface PlaylistSongRow {
  id: string
  yt_id: string | null
  title: string
  artist_id: string | null
  artist_name: string | null
  album_id: string | null
  album_title: string | null
  duration: number | null
  file_path: string
  thumbnail: string | null
  track_number: number | null
  genre: string | null
  year: number | null
  bitrate: number | null
  format: string
  file_size: number | null
  play_count: number
  is_favorite: number
  date_added: number
  last_played: number | null
  position: number
  playlist_date_added: number
}

function rowToPlaylist(row: PlaylistRow): Playlist {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    thumbnail: row.thumbnail,
    ytId: row.yt_id,
    songCount: row.song_count,
    dateCreated: row.date_created,
    dateModified: row.date_modified,
  }
}

function rowToPlaylistSong(row: PlaylistSongRow): PlaylistSong {
  return {
    id: row.id,
    ytId: row.yt_id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    albumId: row.album_id,
    albumTitle: row.album_title,
    duration: row.duration ?? 0,
    filePath: row.file_path,
    thumbnail: row.thumbnail,
    trackNumber: row.track_number,
    genre: row.genre,
    year: row.year,
    bitrate: row.bitrate,
    format: (row.format as Song['format']) ?? 'mp3',
    fileSize: row.file_size,
    playCount: row.play_count,
    isFavorite: row.is_favorite === 1,
    dateAdded: row.date_added,
    lastPlayed: row.last_played,
    position: row.position,
    playlistDateAdded: row.playlist_date_added,
  }
}

export function createPlaylist(name: string, description?: string, thumbnail?: string, ytId?: string): Playlist {
  const db = getDatabase()
  const id = uuidv4()
  const now = Date.now()
  db.prepare(
    `INSERT INTO playlists (id, name, description, thumbnail, yt_id, date_created, date_modified)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, name, description ?? null, thumbnail ?? null, ytId ?? null, now, now)

  return getPlaylistById(id)!
}

export function getAllPlaylists(): Playlist[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT p.*, COUNT(ps.song_id) as song_count
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       GROUP BY p.id
       ORDER BY p.date_modified DESC`
    )
    .all() as PlaylistRow[]
  return rows.map(rowToPlaylist)
}

export function getPlaylistById(id: string): Playlist | null {
  const db = getDatabase()
  const row = db
    .prepare(
      `SELECT p.*, COUNT(ps.song_id) as song_count
       FROM playlists p
       LEFT JOIN playlist_songs ps ON ps.playlist_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`
    )
    .get(id) as PlaylistRow | undefined
  return row ? rowToPlaylist(row) : null
}

export function updatePlaylist(id: string, updates: { name?: string; description?: string; thumbnail?: string }): void {
  const db = getDatabase()
  const fields: string[] = ['date_modified = ?']
  const values: unknown[] = [Date.now()]

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name) }
  if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description) }
  if (updates.thumbnail !== undefined) { fields.push('thumbnail = ?'); values.push(updates.thumbnail) }

  values.push(id)
  db.prepare(`UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deletePlaylist(id: string): void {
  const db = getDatabase()
  // playlist_songs cascade deletes due to FK ON DELETE CASCADE
  db.prepare(`DELETE FROM playlists WHERE id = ?`).run(id)
}

export function getPlaylistSongs(playlistId: string): PlaylistSong[] {
  const db = getDatabase()
  const rows = db
    .prepare(
      `SELECT s.*,
              ar.name AS artist_name,
              al.title AS album_title,
              ps.position,
              ps.date_added AS playlist_date_added
       FROM playlist_songs ps
       JOIN songs s ON s.id = ps.song_id
       LEFT JOIN artists ar ON ar.id = s.artist_id
       LEFT JOIN albums  al ON al.id = s.album_id
       WHERE ps.playlist_id = ?
       ORDER BY ps.position ASC`
    )
    .all(playlistId) as PlaylistSongRow[]
  return rows.map(rowToPlaylistSong)
}

export function addSongToPlaylist(playlistId: string, songId: string): void {
  const db = getDatabase()
  // Find the next position
  const maxPos = db
    .prepare(`SELECT COALESCE(MAX(position), -1) as maxpos FROM playlist_songs WHERE playlist_id = ?`)
    .get(playlistId) as { maxpos: number }
  const position = maxPos.maxpos + 1

  db.prepare(
    `INSERT OR IGNORE INTO playlist_songs (playlist_id, song_id, position, date_added)
     VALUES (?, ?, ?, ?)`
  ).run(playlistId, songId, position, Date.now())

  db.prepare(`UPDATE playlists SET date_modified = ? WHERE id = ?`).run(Date.now(), playlistId)
}

export function removeSongFromPlaylist(playlistId: string, songId: string): void {
  const db = getDatabase()
  const removed = db
    .prepare(`SELECT position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`)
    .get(playlistId, songId) as { position: number } | undefined

  if (!removed) return

  db.prepare(`DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`).run(playlistId, songId)

  // Re-sequence positions after the removed one
  db.prepare(
    `UPDATE playlist_songs SET position = position - 1
     WHERE playlist_id = ? AND position > ?`
  ).run(playlistId, removed.position)

  db.prepare(`UPDATE playlists SET date_modified = ? WHERE id = ?`).run(Date.now(), playlistId)
}

export function reorderPlaylistSong(playlistId: string, songId: string, newPosition: number): void {
  const db = getDatabase()
  const current = db
    .prepare(`SELECT position FROM playlist_songs WHERE playlist_id = ? AND song_id = ?`)
    .get(playlistId, songId) as { position: number } | undefined

  if (!current) return

  const oldPos = current.position

  const reorder = db.transaction(() => {
    if (newPosition > oldPos) {
      // Moving down: shift items between old+1 and newPosition up by 1
      db.prepare(
        `UPDATE playlist_songs SET position = position - 1
         WHERE playlist_id = ? AND position > ? AND position <= ?`
      ).run(playlistId, oldPos, newPosition)
    } else {
      // Moving up: shift items between newPosition and old-1 down by 1
      db.prepare(
        `UPDATE playlist_songs SET position = position + 1
         WHERE playlist_id = ? AND position >= ? AND position < ?`
      ).run(playlistId, newPosition, oldPos)
    }
    db.prepare(`UPDATE playlist_songs SET position = ? WHERE playlist_id = ? AND song_id = ?`).run(newPosition, playlistId, songId)
    db.prepare(`UPDATE playlists SET date_modified = ? WHERE id = ?`).run(Date.now(), playlistId)
  })

  reorder()
}
