import { useState } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import type { Playlist, PlaylistSong } from '../../shared/types'
import { SPECIAL_PLAYLISTS } from '../../../shared/constants'
import HeartButton, { HeartIcon } from '../components/ui/HeartButton'

export default function PlaylistsPage() {
  const { playlists, addPlaylist, removePlaylist } = useLibraryStore()
  const { setQueue } = usePlayerStore()
  const { show } = useToast()

  const [selected, setSelected] = useState<Playlist | null>(null)
  const [songs, setSongs] = useState<PlaylistSong[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null)

  const openPlaylist = async (pl: Playlist) => {
    setSelected(pl)
    const s = await window.api.playlists.getSongs(pl.id)
    setSongs(s)
  }

  const createPlaylist = async () => {
    const name = newName.trim()
    if (!name) return
    
    if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      show('A playlist with this name already exists', 'error')
      return
    }

    const pl = await window.api.playlists.create(name)
    addPlaylist(pl)
    setCreating(false)
    setNewName('')
    show(`Playlist "${pl.name}" created`, 'success')
  }

  const deletePlaylist = async () => {
    if (!playlistToDelete) return
    if (playlistToDelete.id === SPECIAL_PLAYLISTS.LIKED_SONGS) {
      show('Cannot delete this playlist', 'error')
      setPlaylistToDelete(null)
      return
    }
    await window.api.playlists.delete(playlistToDelete.id)
    removePlaylist(playlistToDelete.id)
    if (selected?.id === playlistToDelete.id) setSelected(null)
    show('Playlist deleted', 'success')
    setPlaylistToDelete(null)
  }

  if (selected) return (
    <div>
      <div className="page-header">
        <button className="btn-ghost" onClick={() => setSelected(null)}>← Back</button>
        <h1 className="page-title">{selected.id === SPECIAL_PLAYLISTS.LIKED_SONGS ? 'Liked Songs' : selected.name}</h1>
        <button
          className="btn-primary"
          onClick={() => { if (songs.length) setQueue(songs, 0) }}
          disabled={songs.length === 0}
        >▶ Play All</button>
      </div>
      <div className="page-body">
        {songs.length === 0
          ? <div className="empty-state"><div className="empty-state__icon">🎵</div><div className="empty-state__title">Playlist is empty</div></div>
          : songs.map((song, i) => (
              <div
                key={song.id}
                onClick={() => setQueue(songs, i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  borderBottom: '1px solid var(--border)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-elevated)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 13, minWidth: 28 }}>{i + 1}</span>
                {song.thumbnail
                  ? <img src={song.thumbnail} alt="" className="song-row__art" />
                  : <div className="song-row__art-placeholder">♫</div>
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div className="song-row__title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                    <HeartButton
                      isFavorite={song.isFavorite}
                      onClick={(e) => {
                        e.stopPropagation()
                        window.api.library.toggleFavorite(song.id).then((updated) => {
                          if (selected.id === SPECIAL_PLAYLISTS.LIKED_SONGS && updated && !updated.isFavorite) {
                            setSongs((s) => s.filter((x) => x.id !== song.id))
                          }
                        })
                      }}
                      size={16}
                    />
                  </div>
                  <div className="song-row__artist" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName}</div>
                </div>
                {selected.id !== SPECIAL_PLAYLISTS.LIKED_SONGS && (
                  <button
                    style={{ color: 'var(--text-muted)' }}
                    className="btn-icon"
                    onClick={async (e) => {
                      e.stopPropagation()
                      await window.api.playlists.removeSong(selected.id, song.id)
                      setSongs((s) => s.filter((x) => x.id !== song.id))
                    }}
                    title="Remove from playlist"
                  >✕</button>
                )}
              </div>
            ))
        }
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Playlists</h1>
        <button className="btn-primary" onClick={() => setCreating(true)}>+ New Playlist</button>
      </div>
      <div className="page-body">
        {creating && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              className="input"
              placeholder="Playlist name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createPlaylist()}
              autoFocus
              style={{ maxWidth: 320 }}
            />
            <button className="btn-primary" onClick={createPlaylist}>Create</button>
            <button className="btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        )}
        {playlists.length === 0
          ? <div className="empty-state">
              <div className="empty-state__icon">🎶</div>
              <div className="empty-state__title">No playlists yet</div>
              <div className="empty-state__desc">Create one or download a YouTube playlist</div>
            </div>
          : <div className="card-grid">
              {playlists.map((pl) => (
                <div key={pl.id} className="card" onClick={() => openPlaylist(pl)}>
                  <div className="card__art-container" style={{ position: 'relative', marginBottom: 12 }}>
                    {pl.id === SPECIAL_PLAYLISTS.LIKED_SONGS ? (
                      <div className="card__art liked-songs-art">
                        <HeartIcon filled={true} size={64} />
                      </div>
                    ) : pl.thumbnail ? (
                      <img src={pl.thumbnail} alt="" className="card__art" />
                    ) : (
                      <div className="card__art-placeholder">🎶</div>
                    )}
                  </div>
                  <div className="card__title">{pl.id === SPECIAL_PLAYLISTS.LIKED_SONGS ? 'Liked Songs' : pl.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span className="card__sub">{pl.songCount} songs</span>
                    {pl.id !== SPECIAL_PLAYLISTS.LIKED_SONGS && (
                      <button
                        className="btn-icon"
                        onClick={(e) => { e.stopPropagation(); setPlaylistToDelete(pl); }}
                        style={{ color: 'var(--text-muted)' }}
                      >✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
      {playlistToDelete && (
        <Modal
          title="Delete Playlist"
          description={`Are you sure you want to delete the playlist "${playlistToDelete.name}"?`}
          confirmText="Yes, delete"
          cancelText="Cancel"
          danger
          onConfirm={deletePlaylist}
          onCancel={() => setPlaylistToDelete(null)}
        />
      )}
    </div>
  )
}
