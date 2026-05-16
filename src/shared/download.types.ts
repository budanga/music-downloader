// ─── Download-specific types ────────────────────────────────────────────────

export type DownloadStatus =
  | 'queued'
  | 'fetching_info'
  | 'downloading'
  | 'converting'
  | 'embedding_metadata'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused'

export interface DownloadItem {
  id: string
  url: string
  title: string
  thumbnail: string | null
  uploader: string | null
  status: DownloadStatus
  progress: number        // 0–100
  speed: string | null    // e.g. "1.5 MiB/s"
  eta: string | null      // e.g. "00:32"
  error: string | null
  songId: string | null   // populated after completion
  playlistId: string | null
  isPlaylist: boolean
  playlistTotal: number
  playlistDone: number
  addedAt: number
  trackNumber?: number
}

export interface YtDlpMetadata {
  id: string
  title: string
  uploader: string
  artist?: string
  album?: string
  track?: string
  track_number?: number
  album_artist?: string
  release_year?: number
  genre?: string
  thumbnail?: string
  duration?: number
  webpage_url?: string
  url?: string
  playlist_title?: string
  playlist_id?: string
  n_entries?: number
  playlist_index?: number
  entries?: YtDlpMetadata[]
}

export interface DownloadRequest {
  url: string
  format?: 'mp3' | 'flac' | 'm4a'
  quality?: string
  playlistId?: string  // link to existing playlist
}

export interface DownloadProgress {
  downloadId: string
  status: DownloadStatus
  progress: number
  speed: string | null
  eta: string | null
  title: string
  thumbnail: string | null
  uploader: string | null
  playlistTotal: number
  playlistDone: number
  trackNumber?: number
}
