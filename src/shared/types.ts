// ─── Shared Types ──────────────────────────────────────────────────────────────

export interface Song {
  id: string
  ytId: string | null
  title: string
  artistId: string | null
  artistName: string | null
  albumId: string | null
  albumTitle: string | null
  duration: number // seconds
  filePath: string
  thumbnail: string | null
  trackNumber: number | null
  genre: string | null
  year: number | null
  bitrate: number | null
  format: 'mp3' | 'flac' | 'm4a' | 'webm'
  fileSize: number | null
  playCount: number
  isFavorite: boolean
  dateAdded: number // unix timestamp ms
  lastPlayed: number | null
}

export interface Artist {
  id: string
  name: string
  image: string | null
  songCount?: number
}

export interface Album {
  id: string
  title: string
  artistId: string | null
  artistName: string | null
  year: number | null
  thumbnail: string | null
  songCount?: number
}

export interface Playlist {
  id: string
  name: string
  description: string | null
  thumbnail: string | null
  ytId: string | null
  songCount?: number
  dateCreated: number
  dateModified: number
}

export interface PlaylistSong extends Song {
  position: number
  playlistDateAdded: number
}

export interface DownloadHistoryEntry {
  id: string
  ytId: string | null
  url: string
  title: string | null
  status: 'completed' | 'failed' | 'cancelled'
  error: string | null
  songId: string | null
  timestamp: number
}

export interface AppSettings {
  downloadPath: string
  audioFormat: 'mp3' | 'flac' | 'm4a'
  audioQuality: 'best' | '320k' | '256k' | '192k' | '128k'
  embedThumbnail: boolean
  embedMetadata: boolean
  maxConcurrentDownloads: number
  ytdlpPath: string
  ffmpegPath: string
  theme: 'dark' | 'light' | 'system'
  autoUpdateYtdlp: boolean
  showNotifications: boolean
  minimizeToTray: boolean
}

export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'dateAdded' | 'playCount' | 'year'
export type SortOrder = 'asc' | 'desc'

export interface LibraryFilters {
  search?: string
  artistId?: string
  albumId?: string
  genre?: string
  isFavorite?: boolean
}

export interface LibrarySort {
  field: SortField
  order: SortOrder
}
