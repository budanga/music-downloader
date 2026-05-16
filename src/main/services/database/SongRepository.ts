import path from 'path'
import fs from 'fs'
import { uuidv4 } from '../../utils/uuid'
import { getDatabase } from './Database'
import type { Song, Artist, Album, LibraryFilters, LibrarySort } from '../../../shared/types'

// ─── Raw DB rows ─────────────────────────────────────────────────────────────

interface SongRow {
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
}

function rowToSong(row: SongRow): Song {
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
  }
}

// ─── Artist Repository ────────────────────────────────────────────────────────

export function upsertArtist(name: string, image?: string | null): string {
  const db = getDatabase()
  const existing = db.prepare(`SELECT id, image FROM artists WHERE name = ? COLLATE NOCASE`).get(name) as { id: string; image: string | null } | undefined
  
  if (existing) {
    if (image && !existing.image) {
      db.prepare(`UPDATE artists SET image = ? WHERE id = ?`).run(image, existing.id)
    }
    return existing.id
  }

  const id = uuidv4()
  db.prepare(`INSERT INTO artists (id, name, image) VALUES (?, ?, ?)`).run(id, name, image ?? null)
  return id
}

export function getAllArtists(): Artist[] {
  const db = getDatabase()
  return (
    db
      .prepare(
        `SELECT a.id, a.name, a.image, COUNT(s.id) as song_count
       FROM artists a
       LEFT JOIN songs s ON s.artist_id = a.id
       GROUP BY a.id
       ORDER BY a.name COLLATE NOCASE`
      )
      .all() as Array<{ id: string; name: string; image: string | null; song_count: number }>
  ).map((row) => ({ id: row.id, name: row.name, image: row.image, songCount: row.song_count }))
}

export function deleteArtist(id: string): void {
  const db = getDatabase()
  const songs = getAllSongs({ artistId: id })
  for (const song of songs) {
    deleteSong(song.id)
  }
  db.prepare(`DELETE FROM artists WHERE id = ?`).run(id)
}

// ─── Album Repository ─────────────────────────────────────────────────────────

export function upsertAlbum(title: string, artistId: string | null, year?: number | null, thumbnail?: string | null): string {
  const db = getDatabase()
  const existing = db
    .prepare(`SELECT id FROM albums WHERE title = ? COLLATE NOCASE AND (artist_id = ? OR (artist_id IS NULL AND ? IS NULL)) LIMIT 1`)
    .get(title, artistId, artistId) as { id: string } | undefined

  if (existing) {
    // Update thumbnail if we now have one
    if (thumbnail) {
      db.prepare(`UPDATE albums SET thumbnail = ? WHERE id = ? AND thumbnail IS NULL`).run(thumbnail, existing.id)
    }
    return existing.id
  }

  const id = uuidv4()
  db.prepare(`INSERT INTO albums (id, title, artist_id, year, thumbnail) VALUES (?, ?, ?, ?, ?)`).run(id, title, artistId, year ?? null, thumbnail ?? null)
  return id
}

export function getAllAlbums(): Album[] {
  const db = getDatabase()
  return (
    db
      .prepare(
        `SELECT al.id, al.title, al.artist_id, ar.name as artist_name, al.year, al.thumbnail, COUNT(s.id) as song_count
       FROM albums al
       LEFT JOIN artists ar ON ar.id = al.artist_id
       LEFT JOIN songs s ON s.album_id = al.id
       GROUP BY al.id
       ORDER BY al.title COLLATE NOCASE`
      )
      .all() as Array<{ id: string; title: string; artist_id: string | null; artist_name: string | null; year: number | null; thumbnail: string | null; song_count: number }>
  ).map((row) => ({
    id: row.id,
    title: row.title,
    artistId: row.artist_id,
    artistName: row.artist_name,
    year: row.year,
    thumbnail: row.thumbnail,
    songCount: row.song_count,
  }))
}

export function deleteAlbum(id: string): void {
  const db = getDatabase()
  const songs = getAllSongs({ albumId: id })
  for (const song of songs) {
    deleteSong(song.id)
  }
  db.prepare(`DELETE FROM albums WHERE id = ?`).run(id)
}

export function cleanupLibrary(): void {
  const db = getDatabase()
  
  // 1. Delete albums with 0 songs
  db.exec(`
    DELETE FROM albums 
    WHERE id NOT IN (SELECT DISTINCT album_id FROM songs WHERE album_id IS NOT NULL)
  `)

  // 2. Delete artists with 0 songs AND 0 albums (to avoid FK constraint failures)
  db.exec(`
    DELETE FROM artists 
    WHERE id NOT IN (SELECT DISTINCT artist_id FROM songs WHERE artist_id IS NOT NULL)
      AND id NOT IN (SELECT DISTINCT artist_id FROM albums WHERE artist_id IS NOT NULL)
  `)
}

// ─── Song Repository ──────────────────────────────────────────────────────────

const SONG_SELECT = `
  SELECT s.*,
         ar.name  AS artist_name,
         al.title AS album_title
  FROM songs s
  LEFT JOIN artists ar ON ar.id = s.artist_id
  LEFT JOIN albums  al ON al.id = s.album_id
`

export function insertSong(
  data: Omit<Song, 'id' | 'playCount' | 'isFavorite' | 'dateAdded' | 'lastPlayed' | 'artistName' | 'albumTitle'>
): Song {
  const db = getDatabase()
  const id = uuidv4()
  const now = Date.now()

  db.prepare(
    `INSERT OR IGNORE INTO songs
     (id, yt_id, title, artist_id, album_id, duration, file_path, thumbnail,
      track_number, genre, year, bitrate, format, file_size, play_count, is_favorite, date_added)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`
  ).run(
    id,
    data.ytId,
    data.title,
    data.artistId,
    data.albumId,
    data.duration,
    data.filePath,
    data.thumbnail,
    data.trackNumber,
    data.genre,
    data.year,
    data.bitrate,
    data.format,
    data.fileSize,
    now
  )

  return getSongById(id)!
}

export function getSongById(id: string): Song | null {
  const db = getDatabase()
  const row = db.prepare(`${SONG_SELECT} WHERE s.id = ?`).get(id) as SongRow | undefined
  return row ? rowToSong(row) : null
}

export function getSongByYtId(ytId: string): Song | null {
  const db = getDatabase()
  const row = db.prepare(`${SONG_SELECT} WHERE s.yt_id = ?`).get(ytId) as SongRow | undefined
  return row ? rowToSong(row) : null
}

export function updateSong(id: string, updates: Partial<Pick<Song, 'title' | 'genre' | 'year' | 'trackNumber' | 'thumbnail' | 'isFavorite'>>): void {
  const db = getDatabase()
  const fields: string[] = []
  const values: unknown[] = []

  if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title) }
  if (updates.genre !== undefined) { fields.push('genre = ?'); values.push(updates.genre) }
  if (updates.year !== undefined) { fields.push('year = ?'); values.push(updates.year) }
  if (updates.trackNumber !== undefined) { fields.push('track_number = ?'); values.push(updates.trackNumber) }
  if (updates.thumbnail !== undefined) { fields.push('thumbnail = ?'); values.push(updates.thumbnail) }
  if (updates.isFavorite !== undefined) { fields.push('is_favorite = ?'); values.push(updates.isFavorite ? 1 : 0) }

  if (fields.length === 0) return
  values.push(id)
  db.prepare(`UPDATE songs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
}

export function deleteSong(id: string): void {
  const db = getDatabase()
  
  // Get song first to access its relations and file path
  const song = getSongById(id)
  if (!song) return

  // Delete the song record
  db.prepare(`DELETE FROM songs WHERE id = ?`).run(id)

  // Clean up orphaned album in DB
  if (song.albumId) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM songs WHERE album_id = ?`).get(song.albumId) as { count: number }
    if (count.count === 0) {
      db.prepare(`DELETE FROM albums WHERE id = ?`).run(song.albumId)
    }
  }

  // Clean up orphaned artist in DB
  if (song.artistId) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM songs WHERE artist_id = ?`).get(song.artistId) as { count: number }
    if (count.count === 0) {
      db.prepare(`DELETE FROM artists WHERE id = ?`).run(song.artistId)
    }
  }

  // Cleanup empty folders on disk
  if (song.filePath) {
    try {
      const albumDir = path.dirname(song.filePath)
      const artistDir = path.dirname(albumDir)

      // Try to remove album dir if empty
      if (fs.existsSync(albumDir) && fs.readdirSync(albumDir).length === 0) {
        fs.rmdirSync(albumDir)
        
        // Only if album was removed, try to remove artist dir if empty
        if (fs.existsSync(artistDir) && fs.readdirSync(artistDir).length === 0) {
          fs.rmdirSync(artistDir)
        }
      }
    } catch (e) {
      console.error('[DEBUG] Failed to cleanup empty folders:', e)
    }
  }
}

export function incrementPlayCount(id: string): void {
  const db = getDatabase()
  db.prepare(`UPDATE songs SET play_count = play_count + 1, last_played = ? WHERE id = ?`).run(Date.now(), id)
}

export function getAllSongs(filters?: LibraryFilters, sort?: LibrarySort): Song[] {
  const db = getDatabase()
  const where: string[] = []
  const params: unknown[] = []

  if (filters?.artistId) { where.push('s.artist_id = ?'); params.push(filters.artistId) }
  if (filters?.albumId) { where.push('s.album_id = ?'); params.push(filters.albumId) }
  if (filters?.genre) { where.push('s.genre = ? COLLATE NOCASE'); params.push(filters.genre) }
  if (filters?.isFavorite) { where.push('s.is_favorite = 1') }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

  const sortMap: Record<string, string> = {
    title: 's.title COLLATE NOCASE',
    artist: 'ar.name COLLATE NOCASE',
    album: 'al.title COLLATE NOCASE',
    duration: 's.duration',
    dateAdded: 's.date_added',
    playCount: 's.play_count',
    year: 's.year',
  }

  const sortField = sortMap[sort?.field ?? 'dateAdded'] ?? 's.date_added'
  const sortOrder = sort?.order === 'asc' ? 'ASC' : 'DESC'

  const rows = db.prepare(`${SONG_SELECT} ${whereClause} ORDER BY ${sortField} ${sortOrder}`).all(...params) as SongRow[]
  return rows.map(rowToSong)
}

export function getRecentlyPlayed(limit = 20): Song[] {
  const db = getDatabase()
  const rows = db.prepare(`${SONG_SELECT} WHERE s.last_played IS NOT NULL ORDER BY s.last_played DESC LIMIT ?`).all(limit) as SongRow[]
  return rows.map(rowToSong)
}

export function getMostPlayed(limit = 20): Song[] {
  const db = getDatabase()
  const rows = db.prepare(`${SONG_SELECT} WHERE s.play_count > 0 ORDER BY s.play_count DESC LIMIT ?`).all(limit) as SongRow[]
  return rows.map(rowToSong)
}

export function searchSongs(query: string): Song[] {
  const db = getDatabase()
  const like = `%${query}%`
  const rows = db
    .prepare(
      `${SONG_SELECT}
       WHERE s.title LIKE ? OR ar.name LIKE ? OR al.title LIKE ? OR s.genre LIKE ?
       LIMIT 300`
    )
    .all(like, like, like, like) as SongRow[]
  return rows.map(rowToSong)
}

// FTS stub — kept for API compatibility, actual search uses LIKE
export function rebuildFts(): void {
  // No-op: using LIKE-based search
}
