import { useState } from 'react'
import { useDownloadStore } from '../store/downloadStore'
import { useToast } from '../components/ui/Toast'
import type { DownloadItem } from '../../shared/download.types'

const statusLabel: Record<DownloadItem['status'], string> = {
  queued: 'Queued',
  fetching_info: 'Fetching info…',
  downloading: 'Downloading',
  converting: 'Converting…',
  embedding_metadata: 'Embedding metadata…',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  paused: 'Paused',
}

const statusClass: Record<DownloadItem['status'], string> = {
  queued: 'queued',
  fetching_info: 'downloading',
  downloading: 'downloading',
  converting: 'converting',
  embedding_metadata: 'converting',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'queued',
  paused: 'queued',
}

function DownloadItemCard({ item }: { item: DownloadItem }) {
  const { show } = useToast()
  const fillClass = item.status === 'completed' ? 'done' : item.status === 'failed' ? 'error' : 'active'

  return (
    <div className="dl-item" style={{ marginBottom: 12 }}>
      {item.thumbnail
        ? <img src={item.thumbnail} alt="" className="dl-item__thumb" />
        : <div className="dl-item__thumb" style={{ background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>♫</div>
      }
      <div style={{ minWidth: 0 }}>
        <div className="dl-item__title">{item.title || 'Unknown'}</div>
        <div className="dl-item__sub">{item.uploader || ''}</div>
        <div className="progress-bar">
          <div
            className={`progress-bar__fill progress-bar__fill--${fillClass}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span className={`dl-item__status status-text--${statusClass[item.status]}`}>
            {statusLabel[item.status]}
            {item.status === 'downloading' && item.speed ? ` · ${item.speed}` : ''}
            {item.status === 'downloading' && item.eta ? ` · ETA ${item.eta}` : ''}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{Math.round(item.progress)}%</span>
        </div>
        {item.error && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{item.error}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
        <button
          className="btn-icon"
          style={{ color: 'var(--text-muted)', padding: 4, marginBottom: 4 }}
          onClick={async () => {
            if (['queued', 'downloading', 'fetching_info', 'converting'].includes(item.status)) {
              await window.api.downloads.cancel(item.id)
            }
            useDownloadStore.getState().removeItem(item.id)
          }}
          title="Remove"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        {item.status === 'failed' && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12 }}
            onClick={async () => {
              await window.api.downloads.retry(item.id)
              show('Retrying…', 'info')
            }}
          >Retry</button>
        )}
        {(item.status === 'queued' || item.status === 'downloading' || item.status === 'fetching_info') && (
          <>
            <button
              className="btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => window.api.downloads.pause(item.id)}
            >Pause</button>
            <button
              className="btn-ghost danger"
              style={{ fontSize: 12 }}
              onClick={() => window.api.downloads.cancel(item.id)}
            >Cancel</button>
          </>
        )}
        {item.status === 'paused' && (
          <button
            className="btn-ghost"
            style={{ fontSize: 12 }}
            onClick={() => window.api.downloads.resume(item.id)}
          >Resume</button>
        )}
      </div>
    </div>
  )
}

export default function DownloadsPage() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'mp3' | 'flac' | 'm4a'>('mp3')
  const [isStarting, setIsStarting] = useState(false)
  const { queue, clearCompleted } = useDownloadStore()
  const { show } = useToast()

  const items = Array.from(queue.values()).sort((a, b) => b.addedAt - a.addedAt)
  const active = items.filter((i) => !['completed', 'failed', 'cancelled'].includes(i.status))
  const done   = items.filter((i) => ['completed', 'failed', 'cancelled'].includes(i.status))

  const startDownload = async () => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) return

    // Regex for YouTube and YouTube Music URLs (videos and playlists)
    const ytRegex = /^(https?:\/\/)?(www\.|music\.)?(youtube\.com|youtu\.be)\/(watch\?v=|playlist\?list=|v\/|embed\/)?([a-zA-Z0-9_-]{11}|[a-zA-Z0-9_-]{34})(&.*)?$/
    
    if (!ytRegex.test(trimmedUrl)) {
      show('Please enter a valid YouTube or YouTube Music URL', 'error')
      return
    }

    setIsStarting(true)
    try {
      const result = await window.api.downloads.start({ url: trimmedUrl, format })
      if (result.success) {
        setUrl('')
        show('Download started!', 'success')
      } else {
        show(result.error || 'Failed to start download', 'error')
      }
    } finally {
      setIsStarting(false)
    }
  }

  const handleClearCompleted = async () => {
    await window.api.downloads.clearCompleted()
    clearCompleted()
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 className="page-title">Downloads</h1>
          {active.length > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn-ghost" 
                style={{ fontSize: 12, padding: '4px 8px' }}
                onClick={() => window.api.downloads.pause()}
              >
                Pause All
              </button>
              {items.some(i => i.status === 'paused') && (
                <button 
                  className="btn-ghost" 
                  style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => window.api.downloads.resume()}
                >
                  Resume All
                </button>
              )}
            </div>
          )}
        </div>
        {done.length > 0 && (
          <button className="btn-ghost" onClick={handleClearCompleted}>Clear Completed</button>
        )}
      </div>
      <div className="page-body">
        {/* Download Input */}
        <div className="download-input-bar" style={{ marginBottom: 28 }}>
          <input
            placeholder="Paste YouTube Music URL — song or playlist…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDownload()}
          />
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as typeof format)}
            className="input"
            style={{ width: 80, padding: '6px 10px' }}
          >
            <option value="mp3">MP3</option>
            <option value="flac">FLAC</option>
            <option value="m4a">M4A</option>
          </select>
          <button className="btn-primary" onClick={startDownload} disabled={isStarting}>
            {isStarting ? '…' : '↓ Download'}
          </button>
        </div>

        {/* Active downloads */}
        {active.length > 0 && (
          <>
            <div className="settings-section__title" style={{ marginBottom: 12 }}>Active</div>
            {active.map((item) => <DownloadItemCard key={item.id} item={item} />)}
          </>
        )}

        {/* Completed */}
        {done.length > 0 && (
          <>
            <div className="settings-section__title" style={{ marginBottom: 12, marginTop: 24 }}>History</div>
            {done.map((item) => <DownloadItemCard key={item.id} item={item} />)}
          </>
        )}

        {items.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">⬇️</div>
            <div className="empty-state__title">No downloads yet</div>
            <div className="empty-state__desc">Paste a YouTube Music URL above to get started</div>
          </div>
        )}
      </div>
    </div>
  )
}
