import { getDatabase } from './Database'
import type { AppSettings } from '../../../shared/types'
import path from 'path'

// We lazily resolve the default download path using env vars / known Windows path
function getDefaultMusicPath(): string {
  const userProfile = process.env['USERPROFILE'] ?? process.env['HOME'] ?? 'C:\\Users\\User'
  return path.join(userProfile, 'Music', 'MusicDownloader')
}

const DEFAULT_SETTINGS: AppSettings = {
  get downloadPath() { return getDefaultMusicPath() },
  audioFormat: 'mp3',
  audioQuality: 'best',
  embedThumbnail: true,
  embedMetadata: true,
  maxConcurrentDownloads: 2,
  ytdlpPath: 'yt-dlp',
  ffmpegPath: 'ffmpeg',
  theme: 'dark',
  autoUpdateYtdlp: false,
  showNotifications: true,
  minimizeToTray: false,
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const db = getDatabase()
  const row = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined
  if (!row) return DEFAULT_SETTINGS[key]

  try {
    return JSON.parse(row.value) as AppSettings[K]
  } catch {
    return row.value as unknown as AppSettings[K]
  }
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  const db = getDatabase()
  db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`).run(key, JSON.stringify(value))
}

export function getAllSettings(): AppSettings {
  const db = getDatabase()
  const rows = db.prepare(`SELECT key, value FROM settings`).all() as { key: string; value: string }[]
  const settings: AppSettings = { ...DEFAULT_SETTINGS }

  for (const { key, value } of rows) {
    if (key in settings) {
      try {
        ;(settings as Record<string, unknown>)[key] = JSON.parse(value)
      } catch {
        ;(settings as Record<string, unknown>)[key] = value
      }
    }
  }

  return settings
}
