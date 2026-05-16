import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'
import type { YtDlpMetadata } from '../../../shared/download.types'

/**
 * Wrapper around the yt-dlp executable.
 * Handles fetching metadata, downloading audio, and progress parsing.
 */
export class YtDlpWrapper {
  private ytdlpPath: string
  private ffmpegPath: string

  constructor(ytdlpPath = 'yt-dlp', ffmpegPath = 'ffmpeg') {
    this.ytdlpPath = ytdlpPath
    this.ffmpegPath = ffmpegPath
  }

  // ─── Metadata ───────────────────────────────────────────────────────────────

  /**
   * Fetch metadata for a URL without downloading.
   * Returns parsed JSON from yt-dlp --dump-json.
   */
  async getMetadata(url: string, signal?: AbortSignal): Promise<YtDlpMetadata> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Aborted'))

      const args = [
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        '--quiet',
        '--retries', '5',
        '--fragment-retries', '5',
        url,
      ]

      let output = ''
      const proc = spawn(this.ytdlpPath, args)

      proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
      proc.stderr.on('data', (_chunk: Buffer) => { /* ignore warnings */ })

      const onAbort = () => {
        proc.kill()
        reject(new Error('Aborted'))
      }
      signal?.addEventListener('abort', onAbort)

      proc.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort)
        if (code !== 0 && !output) {
          reject(new Error(`yt-dlp exited with code ${code}`))
          return
        }
        try {
          const lines = output.trim().split('\n').filter(Boolean)
          if (lines.length === 0) throw new Error('No output from yt-dlp')
          console.log(`[DEBUG yt-dlp] getMetadata success. lines: ${lines.length}, first line length: ${lines[0].length}`)
          resolve(JSON.parse(lines[0]) as YtDlpMetadata)
        } catch (e) {
          console.error(`[DEBUG yt-dlp] getMetadata parse error:`, e, '\nRaw output start:', output.substring(0, 200))
          reject(new Error(`Failed to parse yt-dlp metadata: ${String(e)}`))
        }
      })

      proc.on('error', reject)
    })
  }

  /**
   * Fetch metadata for a playlist URL.
   * Returns array of entries (may be large for long playlists).
   */
  async getPlaylistMetadata(url: string, signal?: AbortSignal): Promise<YtDlpMetadata[]> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new Error('Aborted'))

      const args = [
        '--dump-json',
        '--yes-playlist',
        '--no-warnings',
        '--quiet',
        '--flat-playlist',
        '--retries', '5',
        '--fragment-retries', '5',
        url,
      ]

      let output = ''
      const proc = spawn(this.ytdlpPath, args)

      proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
      proc.stderr.on('data', (_chunk: Buffer) => { /* ignore */ })

      const onAbort = () => {
        proc.kill()
        reject(new Error('Aborted'))
      }
      signal?.addEventListener('abort', onAbort)

      proc.on('close', (code) => {
        signal?.removeEventListener('abort', onAbort)
        if (code !== 0 && !output) {
          console.error(`[DEBUG yt-dlp] getPlaylistMetadata process exited with code ${code}`)
          reject(new Error(`yt-dlp exited with code ${code}`))
          return
        }
        try {
          // Each line is a JSON object
          const lines = output.trim().split('\n').filter(Boolean)
          console.log(`[DEBUG yt-dlp] getPlaylistMetadata raw lines count: ${lines.length}`)
          const entries = lines.map((line) => JSON.parse(line) as YtDlpMetadata)
          resolve(entries)
        } catch (e) {
          console.error(`[DEBUG yt-dlp] getPlaylistMetadata parse error:`, e, '\nRaw output start:', output.substring(0, 200))
          reject(new Error(`Failed to parse playlist metadata: ${String(e)}`))
        }
      })

      proc.on('error', reject)
    })
  }

  // ─── Download ────────────────────────────────────────────────────────────────

  /**
   * Download a single track.
   * Returns a child process and output file path template.
   * Calls onProgress with parsed progress info.
   */
  download(options: {
    url: string
    outputDir: string
    format: 'mp3' | 'flac' | 'm4a'
    quality: string
    ffmpegPath?: string
    onProgress?: (progress: number, speed: string, eta: string) => void
    onTitle?: (title: string) => void
  }): { process: ChildProcess; getOutputPath: () => string } {
    const { url, outputDir, format, quality, onProgress, onTitle } = options
    const ffmpeg = options.ffmpegPath ?? this.ffmpegPath

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true })

    // yt-dlp output template — sanitized filename
    const outputTemplate = path.join(outputDir, '%(artist)s - %(title)s [%(id)s].%(ext)s')

    const audioQuality = quality === 'best' ? '0' : quality.replace('k', '')

    const args: string[] = [
      '--no-playlist',
      '--extract-audio',
      '--audio-format', format,
      '--audio-quality', audioQuality,
      '--embed-thumbnail',
      '--embed-metadata',
      '--add-metadata',
      '--parse-metadata', 'description:(?P<meta_comment>)',
      '--ffmpeg-location', ffmpeg,
      '--output', outputTemplate,
      '--newline',    // one progress line per update
      '--progress',
      '--no-warnings',
      '--retries', '5',
      '--fragment-retries', '5',
      url,
    ]

    let lastOutputPath = ''

    const proc = spawn(this.ytdlpPath, args)

    proc.stdout.on('data', (chunk: Buffer) => {
      const lines = chunk.toString().split('\n')
      for (const line of lines) {
        if (!line.trim()) continue

        // Parse destination line to know file path (catches [download], [ExtractAudio], [ffmpeg], etc)
        const destMatch = line.match(/^\[.*?\] Destination: (.+)$/)
        if (destMatch) {
          lastOutputPath = destMatch[1].trim()
        }

        // Parse title
        const titleMatch = line.match(/^\[info\] (.+): Downloading/)
        if (titleMatch && onTitle) {
          onTitle(titleMatch[1])
        }

        // Parse progress: [download]  xx.x% of yy.yyMiB at zz.zzMiB/s ETA hh:mm
        const progressMatch = line.match(
          /\[download\]\s+([\d.]+)%.*?at\s+([\d.]+\s*\w+\/s).*?ETA\s+([\d:]+)/
        )
        if (progressMatch && onProgress) {
          const pct = parseFloat(progressMatch[1])
          const speed = progressMatch[2]
          const eta = progressMatch[3]
          onProgress(pct, speed, eta)
        }

        // Handle already downloaded
        if (line.includes('has already been downloaded')) {
          const alreadyMatch = line.match(/\[download\] (.+) has already been downloaded/)
          if (alreadyMatch) {
            lastOutputPath = alreadyMatch[1].trim()
            if (onProgress) onProgress(100, '0 KiB/s', '0:00')
          }
        }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      console.error(`[yt-dlp stderr] ${chunk.toString()}`)
    })

    return {
      process: proc,
      getOutputPath: () => lastOutputPath,
    }
  }

  // ─── Utilities ───────────────────────────────────────────────────────────────

  /**
   * Check if yt-dlp is available and return its version string.
   */
  async checkAvailability(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytdlpPath, ['--version'])
      let output = ''
      proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(output.trim())
        else reject(new Error('yt-dlp not found. Please install it or set the correct path in Settings.'))
      })
      proc.on('error', () => {
        reject(new Error('yt-dlp not found. Please install it or set the correct path in Settings.'))
      })
    })
  }

  /**
   * Self-update yt-dlp.
   */
  async selfUpdate(): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytdlpPath, ['-U'])
      let output = ''
      proc.stdout.on('data', (d: Buffer) => { output += d.toString() })
      proc.stderr.on('data', (d: Buffer) => { output += d.toString() })
      proc.on('close', (code) => {
        if (code === 0) resolve(output.trim())
        else reject(new Error(`yt-dlp update failed: ${output}`))
      })
      proc.on('error', reject)
    })
  }

  /** Detect if URL is a playlist */
  static isPlaylistUrl(url: string): boolean {
    return /[?&]list=/.test(url) || /\/playlist\?/.test(url) || /music\.youtube\.com.*list=/.test(url)
  }

  /** Validate that a URL looks like a YouTube/YT Music URL */
  static isValidUrl(url: string): boolean {
    const patterns = [
      /^https?:\/\/(www\.|music\.)?youtube\.com\/watch\?/,
      /^https?:\/\/(www\.|music\.)?youtube\.com\/playlist\?/,
      /^https?:\/\/youtu\.be\//,
    ]
    return patterns.some((p) => p.test(url.trim()))
  }
}
