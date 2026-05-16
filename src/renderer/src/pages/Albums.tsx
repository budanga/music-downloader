import { useState } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import type { Album } from '../../shared/types'
import { formatTime } from '../hooks/useAudioPlayer'

export default function AlbumsPage() {
  const { albums, songs } = useLibraryStore()
  const { setQueue, currentSong } = usePlayerStore()

  const [selected, setSelected] = useState<Album | null>(null)

  const playAlbum = (albumId: string) => {
    const albumSongs = songs
      .filter((s) => s.albumId === albumId)
      .sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999))
    if (albumSongs.length > 0) setQueue(albumSongs, 0)
  }

  if (albums.length === 0) return (
    <div className="empty-state">
      <div className="empty-state__icon">💿</div>
      <div className="empty-state__title">No albums yet</div>
      <div className="empty-state__desc">Download music to see albums here</div>
    </div>
  )

  const albumSongs = selected ? songs
    .filter(s => s.albumId === selected.id)
    .sort((a, b) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999)) : []

  if (selected) return (
    <div>
      <div className="page-header">
        <button className="btn-ghost" onClick={() => setSelected(null)}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {selected.thumbnail ? <img src={selected.thumbnail} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} alt=""/> : <div className="card__art-placeholder" style={{ width: 64, height: 64, margin: 0 }}>💿</div>}
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{selected.title}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{selected.artistName}</div>
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => { if (albumSongs.length) setQueue(albumSongs, 0) }}
          disabled={albumSongs.length === 0}
        >▶ Play All</button>
      </div>
      <div className="page-body">
        {albumSongs.length === 0
          ? <div className="empty-state"><div className="empty-state__icon">🎵</div><div className="empty-state__title">No songs</div></div>
          : albumSongs.map((song, i) => {
              const isActive = song.id === currentSong?.id
              return (
                <div
                  key={song.id}
                  onClick={() => setQueue(albumSongs, i)}
                  className={isActive ? 'playing' : ''}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isActive ? 'rgba(108,99,255,0.12)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, minWidth: 28 }}>{song.trackNumber || i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div className="song-row__title" style={{ color: isActive ? 'var(--accent-light)' : undefined }}>{song.title}</div>
                    <div className="song-row__artist">{song.artistName}</div>
                  </div>
                  <div className="song-row__muted">{formatTime(song.duration)}</div>
                </div>
              )
            })
        }
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Albums <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{albums.length}</span></h1>
      </div>
      <div className="page-body">
        <div className="card-grid">
          {albums.map((album) => (
            <div key={album.id} className="card" onClick={() => setSelected(album)}>
              {album.thumbnail
                ? <img src={album.thumbnail} alt="" className="card__art" />
                : <div className="card__art-placeholder">💿</div>
              }
              <div className="card__title">{album.title}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                <div className="card__sub" style={{ margin: 0, paddingRight: 8 }}>{album.artistName} · {album.songCount} song{album.songCount !== 1 ? 's' : ''}</div>
                <button 
                  className="btn-icon" 
                  style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); playAlbum(album.id); }}
                >▶</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
