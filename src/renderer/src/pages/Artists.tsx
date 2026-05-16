import { useState, useEffect } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import type { Artist, Song, Playlist } from '../../shared/types'
import { formatTime } from '../hooks/useAudioPlayer'
import HeartButton from '../components/ui/HeartButton'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { SPECIAL_PLAYLISTS } from '../../../shared/constants'

export default function ArtistsPage() {
  const { artists, songs, playlists } = useLibraryStore()
  const { setQueue, currentSong, togglePlay, isPlaying } = usePlayerStore()
  const { show } = useToast()

  const [selected, setSelected] = useState<Artist | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, song: Song } | null>(null)
  const [playlistModal, setPlaylistModal] = useState(false)
  const [newPlaylistPrompt, setNewPlaylistPrompt] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  const playArtist = (artistId: string) => {
    const artistSongs = songs.filter((s) => s.artistId === artistId)
    if (artistSongs.length > 0) setQueue(artistSongs, 0)
  }

  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
    e.preventDefault()
    let x = e.clientX
    let y = e.clientY
    if (window.innerWidth - x < 200) x = window.innerWidth - 200
    if (window.innerHeight - y < 250) y = window.innerHeight - 250
    setContextMenu({ x, y, song })
  }

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    window.addEventListener('contextmenu', closeMenu)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('contextmenu', closeMenu)
    }
  }, [])

  const addToPlaylist = (p: Playlist, songId: string) => {
    window.api.playlists.addSong(p.id, songId)
    show(`Added to ${p.name}`, 'success')
    setContextMenu(null)
    setPlaylistModal(false)
  }

  const createPlaylistAndAdd = async () => {
    const name = newPlaylistName.trim()
    if (!name || !contextMenu?.song) return
    
    if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      show('A playlist with this name already exists', 'error')
      return
    }

    try {
      const p = await window.api.playlists.create(name)
      useLibraryStore.getState().addPlaylist(p)
      window.api.playlists.addSong(p.id, contextMenu.song.id)
      show(`Created and added to ${name}`, 'success')
      setNewPlaylistPrompt(false)
      setNewPlaylistName('')
      setContextMenu(null)
    } catch (e) {
      console.error(e)
    }
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
                  onClick={() => {
                    if (isActive) togglePlay()
                    else setQueue(artistSongs, i)
                  }}
                  className={isActive ? 'playing' : ''}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isActive ? 'rgba(108,99,255,0.12)' : 'transparent',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                  onContextMenu={(e) => handleContextMenu(e, song)}
                >
                  <span style={{ color: 'var(--text-muted)', fontSize: 13, minWidth: 28 }}>{isActive && isPlaying ? '▶' : i + 1}</span>
                  {song.thumbnail
                    ? <img src={song.thumbnail} alt="" className="song-row__art" />
                    : <div className="song-row__art-placeholder">♫</div>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="song-row__title" style={{ color: isActive ? 'var(--accent-light)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                      <HeartButton
                        isFavorite={song.isFavorite}
                        onClick={(e) => { e.stopPropagation(); window.api.library.toggleFavorite(song.id) }}
                        size={16}
                      />
                    </div>
                    <div className="song-row__artist" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.albumTitle || 'Unknown Album'}</div>
                  </div>
                  <div className="song-row__muted">{formatTime(song.duration)}</div>
                </div>
              )
            })
        }
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu__item" onClick={() => {
            usePlayerStore.getState().playNext(contextMenu.song);
            show(`Playing next`, 'success');
            setContextMenu(null);
          }}>
            🎵 Play next
          </div>
          <div className="context-menu__sep"></div>
          <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Add to Playlist</div>
          <div className="context-menu__item" onClick={() => {
            setNewPlaylistPrompt(true);
            setContextMenu(null);
          }}>
            + New Playlist...
          </div>
          {playlists.filter(p => p.id !== SPECIAL_PLAYLISTS.LIKED_SONGS).slice(0, 5).map(p => (
            <div key={p.id} className="context-menu__item" onClick={() => addToPlaylist(p, contextMenu.song.id)}>
              • {p.name}
            </div>
          ))}
          {playlists.filter(p => p.id !== SPECIAL_PLAYLISTS.LIKED_SONGS).length > 5 && (
            <div className="context-menu__item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => { setPlaylistModal(true); setContextMenu(null); }}>
              <span>Other</span>
              <span style={{ fontSize: 16, opacity: 0.5 }}>&gt;</span>
            </div>
          )}
        </div>
      )}

      {playlistModal && contextMenu?.song && (
        <Modal
          title="Add to Playlist"
          description={`Select a playlist for "${contextMenu.song.title}"`}
          onCancel={() => setPlaylistModal(false)}
        >
          <div className="playlist-selection-grid" style={{ maxHeight: 300, overflowY: 'auto', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {playlists.filter(p => p.id !== SPECIAL_PLAYLISTS.LIKED_SONGS).map(p => (
              <div
                key={p.id}
                className="context-menu__item"
                style={{ borderRadius: 8, padding: '12px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => addToPlaylist(p, contextMenu.song.id)}
              >
                <div style={{ fontSize: 20 }}>🎶</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {newPlaylistPrompt && (
        <Modal
          title="New Playlist"
          description="Enter a name for your new playlist."
          confirmText="Create"
          onConfirm={createPlaylistAndAdd}
          onCancel={() => { setNewPlaylistPrompt(false); setNewPlaylistName(''); }}
        >
          <input
            className="input"
            autoFocus
            placeholder="Playlist name..."
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createPlaylistAndAdd()}
            style={{ marginTop: 12 }}
          />
        </Modal>
      )}
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
