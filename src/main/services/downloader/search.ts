import { spawn } from 'child_process'
import type { SearchResult } from '../../../shared/types'

const LIMIT = 12

/**
 * Searches for something to download.
 * - YouTube: `yt-dlp ytsearch` (flat, nothing is downloaded).
 * - YouTube Music: the site's own search endpoint, filtered to songs. yt-dlp's YouTube Music
 *   search only returns titles (no artist or duration), so it's used only as a fallback.
 */
export async function search(
  query: string,
  source: 'youtube' | 'ytmusic',
  ytdlpPath: string
): Promise<SearchResult[]> {
  if (source === 'ytmusic') {
    try {
      const results = await searchYtMusic(query)
      if (results.length) return results
    } catch (e) {
      console.warn('YouTube Music search failed, using yt-dlp:', e)
    }
  }
  return searchYtDlp(query, ytdlpPath)
}

function searchYtDlp(query: string, ytdlpPath: string): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ytdlpPath, [
      `ytsearch${LIMIT}:${query}`,
      '--flat-playlist',
      '--dump-single-json',
      '--no-warnings'
    ])
    let out = ''
    let err = ''
    proc.stdout.on('data', (d: Buffer) => (out += d.toString()))
    proc.stderr.on('data', (d: Buffer) => (err += d.toString()))
    const timer = setTimeout(() => proc.kill(), 30_000)
    proc.on('error', () => {
      clearTimeout(timer)
      reject(new Error('yt-dlp not found'))
    })
    proc.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) return reject(new Error(err.trim() || `yt-dlp exited with ${code}`))
      try {
        const data = JSON.parse(out) as {
          entries?: Array<{
            id: string
            title?: string
            channel?: string
            uploader?: string
            duration?: number
          }>
        }
        resolve(
          (data.entries ?? [])
            .filter((e) => e.id && e.title)
            .map((e) => ({
              id: e.id,
              url: `https://www.youtube.com/watch?v=${e.id}`,
              title: e.title!,
              artist: e.channel ?? e.uploader ?? null,
              album: null,
              duration: typeof e.duration === 'number' ? e.duration : null,
              thumbnail: `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg`
            }))
        )
      } catch (e) {
        reject(e)
      }
    })
  })
}

type Runs = {
  runs?: Array<{ text: string; navigationEndpoint?: { watchEndpoint?: { videoId?: string } } }>
}
interface ListItem {
  playlistItemData?: { videoId?: string }
  flexColumns?: Array<{ musicResponsiveListItemFlexColumnRenderer?: { text?: Runs } }>
  thumbnail?: { musicThumbnailRenderer?: { thumbnail?: { thumbnails?: Array<{ url: string }> } } }
}

/** "4:51" or "1:02:03" → seconds */
const toSeconds = (s: string) =>
  /^\d+(:\d{1,2})+$/.test(s) ? s.split(':').reduce((t, p) => t * 60 + Number(p), 0) : null

async function searchYtMusic(query: string): Promise<SearchResult[]> {
  const res = await fetch('https://music.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://music.youtube.com' },
    body: JSON.stringify({
      context: { client: { clientName: 'WEB_REMIX', clientVersion: '1.20241106.01.00', hl: 'es' } },
      query,
      params: 'EgWKAQIIAWoKEAoQCRADEAQQBRAV' // "Songs" filter
    }),
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  // The rows sit deep inside nested renderers; collect them wherever they are
  const items: ListItem[] = []
  const walk = (o: unknown): void => {
    if (!o || typeof o !== 'object') return
    const rec = o as Record<string, unknown>
    if (rec.musicResponsiveListItemRenderer)
      items.push(rec.musicResponsiveListItemRenderer as ListItem)
    else for (const v of Object.values(rec)) walk(v)
  }
  walk(await res.json())

  const text = (c?: { musicResponsiveListItemFlexColumnRenderer?: { text?: Runs } }) =>
    c?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.map((r) => r.text).join('') ?? ''

  const results: SearchResult[] = []
  for (const it of items) {
    const titleCol = it.flexColumns?.[0]
    const id =
      it.playlistItemData?.videoId ??
      titleCol?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint
        ?.watchEndpoint?.videoId
    const title = text(titleCol)
    if (!id || !title) continue
    // Second column: "Artist • Album • 4:51"
    const parts = text(it.flexColumns?.[1])
      .split(' • ')
      .map((p) => p.trim())
    const duration = parts.length ? toSeconds(parts[parts.length - 1]) : null
    const meta = duration !== null ? parts.slice(0, -1) : parts
    results.push({
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      title,
      artist: meta[0] || null,
      album: meta[1] || null,
      duration,
      thumbnail: it.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ?? null
    })
    if (results.length >= LIMIT) break
  }
  return results
}
