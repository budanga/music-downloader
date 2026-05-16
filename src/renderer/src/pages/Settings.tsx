import { useState, useEffect } from 'react'
import { useToast } from '../components/ui/Toast'
import type { AppSettings } from '../../shared/types'

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [ytdlpStatus, setYtdlpStatus] = useState<{ available: boolean; version?: string; error?: string } | null>(null)
  const { show } = useToast()

  useEffect(() => {
    window.api.settings.getAll().then(setSettings)
    window.api.system.checkYtdlp().then(setYtdlpStatus)
  }, [])

  const save = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await window.api.settings.set(key, value)
    setSettings((s) => s ? { ...s, [key]: value } : s)
    show('Setting saved', 'success')
  }

  const chooseDir = async () => {
    const dir = await window.api.system.chooseDirectory()
    if (dir) save('downloadPath', dir)
  }

  const updateYtdlp = async () => {
    show('Updating yt-dlp…', 'info')
    const result = await window.api.system.updateYtdlp()
    if (result.success) { show('yt-dlp updated!', 'success'); window.api.system.checkYtdlp().then(setYtdlpStatus) }
    else show(result.error || 'Update failed', 'error')
  }

  if (!settings) return <div className="empty-state"><div className="pulse">Loading…</div></div>

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>
      <div className="page-body" style={{ maxWidth: 700 }}>

        {/* Download */}
        <div className="settings-section">
          <div className="settings-section__title">Downloads</div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Download Location</div>
              <div className="settings-row__desc">{settings.downloadPath}</div>
            </div>
            <button className="btn-ghost" onClick={chooseDir}>Change…</button>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Audio Format</div>
              <div className="settings-row__desc">Default format for all downloads</div>
            </div>
            <select className="input" style={{ width: 120 }} value={settings.audioFormat}
              onChange={(e) => save('audioFormat', e.target.value as AppSettings['audioFormat'])}>
              <option value="mp3">MP3</option>
              <option value="flac">FLAC</option>
              <option value="m4a">M4A</option>
            </select>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Audio Quality</div>
            </div>
            <select className="input" style={{ width: 120 }} value={settings.audioQuality}
              onChange={(e) => save('audioQuality', e.target.value as AppSettings['audioQuality'])}>
              <option value="best">Best</option>
              <option value="320k">320 kbps</option>
              <option value="256k">256 kbps</option>
              <option value="192k">192 kbps</option>
              <option value="128k">128 kbps</option>
            </select>
          </div>
          <div className="settings-row">
            <div style={{ flex: 1 }}>
              <div className="settings-row__label">Max Concurrent Downloads</div>
              <div className="settings-row__desc">Maximum simultaneous downloads (1-20). Set to 0 for unlimited (soft-capped at 15 for stability).</div>
            </div>
            <input
              className="input"
              type="number" min={0} max={20} style={{ width: 80 }}
              value={settings.maxConcurrentDownloads}
              onChange={(e) => save('maxConcurrentDownloads', parseInt(e.target.value) || 0)}
            />
          </div>
        </div>

        {/* Metadata */}
        <div className="settings-section">
          <div className="settings-section__title">Metadata</div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Embed Thumbnail</div>
              <div className="settings-row__desc">Embed album art into audio files</div>
            </div>
            <input type="checkbox" checked={settings.embedThumbnail}
              onChange={(e) => save('embedThumbnail', e.target.checked)} style={{ width: 18, height: 18 }} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Embed Metadata</div>
              <div className="settings-row__desc">Embed title, artist, album tags</div>
            </div>
            <input type="checkbox" checked={settings.embedMetadata}
              onChange={(e) => save('embedMetadata', e.target.checked)} style={{ width: 18, height: 18 }} />
          </div>
        </div>

        {/* Tools */}
        <div className="settings-section">
          <div className="settings-section__title">Tools</div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">yt-dlp</div>
              <div className="settings-row__desc" style={{ color: ytdlpStatus?.available ? 'var(--green)' : 'var(--red)' }}>
                {ytdlpStatus?.available ? `✓ ${ytdlpStatus.version}` : `✗ Not found — ${ytdlpStatus?.error ?? ''}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" onClick={updateYtdlp}>Update</button>
            </div>
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">yt-dlp Path</div>
            </div>
            <input
              className="input" style={{ maxWidth: 260 }}
              value={settings.ytdlpPath}
              onChange={(e) => save('ytdlpPath', e.target.value)}
              onBlur={() => window.api.system.checkYtdlp().then(setYtdlpStatus)}
            />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">FFmpeg Path</div>
            </div>
            <input
              className="input" style={{ maxWidth: 260 }}
              value={settings.ffmpegPath}
              onChange={(e) => save('ffmpegPath', e.target.value)}
            />
          </div>
        </div>

        {/* App */}
        <div className="settings-section">
          <div className="settings-section__title">Application</div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Show Notifications</div>
            </div>
            <input type="checkbox" checked={settings.showNotifications}
              onChange={(e) => save('showNotifications', e.target.checked)} style={{ width: 18, height: 18 }} />
          </div>
          <div className="settings-row">
            <div>
              <div className="settings-row__label">Minimize to Tray</div>
            </div>
            <input type="checkbox" checked={settings.minimizeToTray}
              onChange={(e) => save('minimizeToTray', e.target.checked)} style={{ width: 18, height: 18 }} />
          </div>
        </div>

      </div>
    </div>
  )
}
