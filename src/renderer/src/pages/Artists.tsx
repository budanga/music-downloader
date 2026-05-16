import { useState } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import type { Artist } from '../../shared/types'
import { formatTime } from '../hooks/useAudioPlayer'

export default function ArtistsPage() {
  const { artists, songs } = useLibraryStore()
  const { setQueue, currentSong } = usePlayerStore()

  const [selected, setSelected] = useState<Artist | null>(null)

  const playArtist = (artistId: string) => {
    const artistSongs = songs.filter((s) => s.artistId === artistId)
    if (artistSongs.length > 0) setQueue(artistSongs, 0)
  }

  if (artists.length === 0) return (
    <div className="empty-state">
      <div className="empty-state__icon">🎤</div>
      <div className="empty-state__title">No artists yet</div>
      <div className="empty-state__desc">Download music to see artists here</div>
    </div>
  )

  const artistSongs = selected ? songs.filter(s => s.artistId === selected.id) : []

  if (selected) return (
    <div>
      <div className="page-header">
        <button className="btn-ghost" onClick={() => setSelected(null)}>← Back</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {selected.image 
            ? <img src={selected.image} style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover' }} alt=""/> 
            : <div className="card__art-placeholder" style={{ width: 64, height: 64, margin: 0, fontSize: 32 }}>🎤</div>
          }
          <div>
            <h1 className="page-title" style={{ fontSize: 24 }}>{selected.name}</h1>
          </div>
        </div>
        <button
          className="btn-primary"
          style={{ marginLeft: 'auto' }}
          onClick={() => { if (artistSongs.length) setQueue(artistSongs, 0) }}
          disabled={artistSongs.length === 0}
        >▶ Play All</button>
      </div>
      <div className="page-body">
        {artistSongs.length === 0
          ? <div className="empty-state"><div className="empty-state__icon">🎵</div><div className="empty-state__title">No songs</div></div>
          : artistSongs.map((song, i) => {
              const isActive = song.id === currentSong?.id
              return (
                <div
                  key={song.id}
                  onClick={() => setQueue(artistSongs, i)}
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
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, minWidth: 28 }}>{i + 1}</span>
                  {song.thumbnail
                    ? <img src={song.thumbnail} alt="" className="song-row__art" />
                    : <div className="song-row__art-placeholder">♫</div>
                  }
                  <div style={{ flex: 1 }}>
                    <div className="song-row__title" style={{ color: isActive ? 'var(--accent-light)' : undefined }}>{song.title}</div>
                    <div className="song-row__artist">{song.albumTitle || 'Unknown Album'}</div>
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
        <h1 className="page-title">Artists <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{artists.length}</span></h1>
      </div>
      <div className="page-body">
        <div className="card-grid">
          {artists.map((artist) => (
            <div key={artist.id} className="card" onClick={() => setSelected(artist)}>
              {artist.image
                ? <img src={artist.image} alt="" className="card__art" />
                : <div className="card__art-placeholder">🎤</div>
              }
              <div className="card__title">{artist.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 4 }}>
                <div className="card__sub" style={{ margin: 0, paddingRight: 8 }}>{artist.songCount} song{artist.songCount !== 1 ? 's' : ''}</div>
                <button 
                  className="btn-icon" 
                  style={{ background: 'var(--accent)', color: 'white', borderRadius: '50%', flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); playArtist(artist.id); }}
                >▶</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
