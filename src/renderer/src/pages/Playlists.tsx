import { useState } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import type { Playlist, PlaylistSong } from '../../shared/types'

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
    if (!newName.trim()) return
    const pl = await window.api.playlists.create(newName.trim())
    addPlaylist(pl)
    setCreating(false)
    setNewName('')
    show(`Playlist "${pl.name}" created`, 'success')
  }

  const deletePlaylist = async () => {
    if (!playlistToDelete) return
    await window.api.playlists.delete(playlistToDelete.id)
    removePlaylist(playlistToDelete.id)
    if (selected?.id === playlistToDelete.id) setSelected(null)
    show('Playlist eliminada', 'success')
    setPlaylistToDelete(null)
  }

  if (selected) return (
    <div>
      <div className="page-header">
        <button className="btn-ghost" onClick={() => setSelected(null)}>← Back</button>
        <h1 className="page-title">{selected.name}</h1>
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
                <div>
                  <div className="song-row__title">{song.title}</div>
                  <div className="song-row__artist">{song.artistName}</div>
                </div>
                <button
                  style={{ marginLeft: 'auto', color: 'var(--text-muted)' }}
                  className="btn-icon"
                  onClick={async (e) => {
                    e.stopPropagation()
                    await window.api.playlists.removeSong(selected.id, song.id)
                    setSongs((s) => s.filter((x) => x.id !== song.id))
                  }}
                >✕</button>
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
                  {pl.thumbnail
                    ? <img src={pl.thumbnail} alt="" className="card__art" />
                    : <div className="card__art-placeholder">🎶</div>
                  }
                  <div className="card__title">{pl.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span className="card__sub">{pl.songCount} songs</span>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); setPlaylistToDelete(pl); }}
                      style={{ color: 'var(--text-muted)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
        }
      </div>
      {playlistToDelete && (
        <Modal
          title="Eliminar Playlist"
          description={`¿Estás seguro que deseas eliminar la playlist "${playlistToDelete.name}"?`}
          confirmText="Sí, eliminar"
          cancelText="Cancelar"
          danger
          onConfirm={deletePlaylist}
          onCancel={() => setPlaylistToDelete(null)}
        />
      )}
    </div>
  )
}
