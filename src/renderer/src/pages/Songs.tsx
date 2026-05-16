import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useDeferredValue } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { formatTime } from '../hooks/useAudioPlayer'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import type { Song, SortField, SortOrder, Playlist } from '../../shared/types'
import HeartButton from '../components/ui/HeartButton'
import { SPECIAL_PLAYLISTS } from '../../../shared/constants'

// FTS search is handled in the main process
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })

const MusicNoteIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
  </svg>
)

export default function SongsPage() {
  const { songs, playlists, isLoading } = useLibraryStore()
  const { currentSong, setQueue, isPlaying, togglePlay } = usePlayerStore()
  const { show } = useToast()

  const [query, setQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('dateAdded')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<Song[] | null>(null)

  // Use backend search when query changes
  useEffect(() => {
    if (!deferredQuery.trim()) {
      setSearchResults(null)
      return
    }
    window.api.library.search(deferredQuery).then(setSearchResults)
  }, [deferredQuery])

  const filtered = useMemo<Song[]>(() => {
    const baseList = searchResults || songs
    const list = [...baseList]
    
    // If not searching, apply the current sort
    if (!deferredQuery.trim()) {
      list.sort((a, b) => {
        let av: string | number = '', bv: string | number = ''
        if (sortField === 'title') return sortOrder === 'asc' ? collator.compare(a.title, b.title) : collator.compare(b.title, a.title)
        if (sortField === 'artist') return sortOrder === 'asc' ? collator.compare(a.artistName ?? '', b.artistName ?? '') : collator.compare(b.artistName ?? '', a.artistName ?? '')
        if (sortField === 'album') return sortOrder === 'asc' ? collator.compare(a.albumTitle ?? '', b.albumTitle ?? '') : collator.compare(b.albumTitle ?? '', a.albumTitle ?? '')
        if (sortField === 'duration') { av = a.duration; bv = b.duration }
        if (sortField === 'dateAdded') { av = a.dateAdded; bv = b.dateAdded }
        if (sortField === 'playCount') { av = a.playCount; bv = b.playCount }
        return sortOrder === 'asc' ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1)
      })
    }
    return list
  }, [songs, searchResults, deferredQuery, sortField, sortOrder])

  const parentRef = useRef<HTMLDivElement>(null)
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  })

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) setSortOrder((o) => o === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortOrder('asc') }
  }, [sortField])

  const playSong = (index: number) => {
    const song = filtered[index]
    if (song.id === currentSong?.id) { togglePlay(); return }
    setQueue(filtered, index)
  }

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, song: Song } | null>(null)
  const [deletePrompt, setDeletePrompt] = useState(false)
  const [playlistModal, setPlaylistModal] = useState(false)
  const [newPlaylistPrompt, setNewPlaylistPrompt] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  
  // Multi-selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastSelectedIndex = useRef<number | null>(null)

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleRowClick = (e: React.MouseEvent, index: number, song: Song) => {
    if (e.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index)
      const end = Math.max(lastSelectedIndex.current, index)
      const next = new Set(selectedIds)
      for (let i = start; i <= end; i++) {
        next.add(filtered[i].id)
      }
      setSelectedIds(next)
    } else if (e.ctrlKey || e.metaKey) {
      e.stopPropagation()
      toggleSelection(song.id)
      lastSelectedIndex.current = index
    } else {
      playSong(index)
      setSelectedIds(new Set([song.id]))
      lastSelectedIndex.current = index
    }
  }

  const deleteMultiple = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} songs from your library?`)) return
    
    for (const id of selectedIds) {
      usePlayerStore.getState().removeBySongId(id)
      await new Promise(r => setTimeout(r, 50)) // release handle
      try {
        await window.api.library.deleteSong(id, true)
      } catch (e) {
        console.error('Failed to delete physical file', e)
      }
      useLibraryStore.getState().removeSong(id)
    }

    window.api.library.getArtists().then(useLibraryStore.getState().setArtists)
    window.api.library.getAlbums().then(useLibraryStore.getState().setAlbums)
       show(`${selectedIds.size} songs deleted`, 'success')
    setSelectedIds(new Set())
    setDeletePrompt(false)
  }

  const handleContextMenu = (e: React.MouseEvent, song: Song) => {
    e.preventDefault()
    let x = e.clientX
    let y = e.clientY
    if (window.innerWidth - x < 200) x = window.innerWidth - 200
    if (window.innerHeight - y < 250) y = window.innerHeight - 250
    
    // If clicking a song that isn't selected, select ONLY this song
    if (!selectedIds.has(song.id)) {
      setSelectedIds(new Set([song.id]))
    }
    
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

  const th = (field: SortField, label: string) => (
    <div onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortField === field ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
    </div>
  )

  const addToPlaylist = (p: Playlist) => {
    for (const id of selectedIds) window.api.playlists.addSong(p.id, id)
    show(`Added to ${p.name}`, 'success')
    setContextMenu(null)
    setPlaylistModal(false)
  }

  const createPlaylistAndAdd = async () => {
    const name = newPlaylistName.trim()
    if (!name) return
    
    // Check if name exists
    if (playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      show('A playlist with this name already exists', 'error')
      return
    }

    try {
      const p = await window.api.playlists.create(name)
      useLibraryStore.getState().addPlaylist(p)
      for (const id of selectedIds) window.api.playlists.addSong(p.id, id)
      show(`Created and added to ${name}`, 'success')
      setNewPlaylistPrompt(false)
      setNewPlaylistName('')
      setContextMenu(null)
    } catch (e) {
      console.error(e)
    }
  }

  if (isLoading) return <div className="empty-state"><div className="spin" style={{ fontSize: 32 }}>⟳</div></div>

  const selectionPlaylists = playlists.filter(p => p.id !== SPECIAL_PLAYLISTS.LIKED_SONGS)
  const visiblePlaylists = selectionPlaylists.slice(0, 5)
  const hasMorePlaylists = selectionPlaylists.length > 5

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h1 className="page-title">Songs <span style={{ color: 'var(--text-muted)', fontSize: 18 }}>{songs.length}</span></h1>
            <Link to="/downloads" className="btn--rainbow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Download Music
            </Link>
            <button className="btn-ghost" onClick={async () => {
              const settings = await window.api.settings.getAll()
              const path = settings.downloadPath || await window.api.system.getDefaultDownloadPath()
              window.api.system.openFile(path)
            }}>
              📁 Folder
            </button>
        </div>
        <div className="search-bar">
          <MusicNoteIcon />
          <input placeholder="Search songs…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0
        ? <div className="empty-state">
          <div className="empty-state__icon">🎵</div>
          <div className="empty-state__title">{query ? 'No results found' : 'Your library is empty'}</div>
          <div className="empty-state__desc">{query ? 'Try a different search' : 'Go to Downloads to add music'}</div>
        </div>
        : <div ref={parentRef} style={{ flex: 1, overflow: 'auto', padding: '0 28px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '40px 3fr 2fr 2fr 60px 60px 40px',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            gap: 12,
            marginBottom: 8
          }}>
            <div>#</div>
            {th('title', 'Title')}
            {th('artist', 'Artist')}
            {th('album', 'Album')}
            {th('duration', 'Time')}
            {th('playCount', 'Plays')}
            <div></div>
          </div>
          <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative' }}>
            {rowVirtualizer.getVirtualItems().map((vrow) => {
              const song = filtered[vrow.index]
              const isActive = song.id === currentSong?.id
              return (
                <div
                  key={vrow.key}
                  data-index={vrow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${vrow.start}px)`,
                  }}
                >
                  <div
                    onClick={(e) => handleRowClick(e, vrow.index, song)}
                    className={`song-table-row${isActive ? ' playing' : ''}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '40px 3fr 2fr 2fr 60px 60px 40px',
                      alignItems: 'center',
                      padding: '4px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? 'rgba(108,99,255,0.12)' : selectedIds.has(song.id) ? 'rgba(108,99,255,0.05)' : 'transparent',
                      borderBottom: '1px solid var(--border)',
                      gap: 12,
                    }}
                    onMouseEnter={(e) => { if (!isActive && !selectedIds.has(song.id)) e.currentTarget.style.background = 'var(--bg-elevated)' }}
                    onMouseLeave={(e) => { if (!isActive && !selectedIds.has(song.id)) e.currentTarget.style.background = 'transparent' }}
                    onContextMenu={(e) => { e.stopPropagation(); handleContextMenu(e, song) }}
                  >
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                      {isActive && isPlaying ? '▶' : vrow.index + 1}
                    </span>
                    <div className="song-row__title-cell" style={{ minWidth: 0 }}>
                      {song.thumbnail
                        ? <img src={song.thumbnail} alt="" className="song-row__art" />
                        : <div className="song-row__art-placeholder"><MusicNoteIcon /></div>
                      }
                      <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="song-row__title" style={{ color: isActive ? 'var(--accent-light)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
                        <HeartButton
                          isFavorite={song.isFavorite}
                          onClick={(e) => { e.stopPropagation(); window.api.library.toggleFavorite(song.id) }}
                          size={16}
                          className="heart-on-hover"
                        />
                      </div>
                    </div>
                    <div className="song-row__artist" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName ?? '—'}</div>
                    <div className="song-row__muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.albumTitle ?? '—'}</div>
                    <div className="song-row__muted">{formatTime(song.duration)}</div>
                    <div className="song-row__muted">{song.playCount}</div>
                    <button
                      className="btn-icon"
                      onClick={(e) => { e.stopPropagation(); handleContextMenu(e, song); }}
                      title="Options"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      }

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y, maxHeight: 450, overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
          <div className="context-menu__item" onClick={() => {
            const songsToPlay = Array.from(selectedIds).map(id => filtered.find(s => s.id === id)!).filter(Boolean);
            [...songsToPlay].reverse().forEach(s => usePlayerStore.getState().playNext(s));
            show(`Playing next`, 'success');
            setContextMenu(null);
          }}>
            🎵 Play next ({selectedIds.size})
          </div>

          <div className="context-menu__sep"></div>
          <div style={{ padding: '4px 12px', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Add to Playlist</div>
          <div className="context-menu__item" onClick={() => {
            setNewPlaylistPrompt(true);
            setContextMenu(null);
          }}>
            + New Playlist...
          </div>
          {visiblePlaylists.map(p => (
            <div key={p.id} className="context-menu__item" onClick={() => addToPlaylist(p)}>
              • {p.name}
            </div>
          ))}
          {hasMorePlaylists && (
            <div className="context-menu__item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onClick={() => { setPlaylistModal(true); setContextMenu(null); }}>
              <span>Other</span>
              <span style={{ fontSize: 16, opacity: 0.5 }}>&gt;</span>
            </div>
          )}

          <div className="context-menu__sep"></div>
          <div className="context-menu__item danger" onClick={(e) => { e.stopPropagation(); setContextMenu(null); setDeletePrompt(true); }}>
            🗑️ Delete ({selectedIds.size})
          </div>
        </div>
      )}

      {deletePrompt && (
        <Modal
          title="Delete songs"
          description={`Are you sure you want to delete ${selectedIds.size} songs from your library? This action cannot be undone.`}
          confirmText="Yes, delete"
          cancelText="Cancel"
          danger
          onConfirm={deleteMultiple}
          onCancel={() => setDeletePrompt(false)}
        />
      )}

      {playlistModal && (
        <Modal
          title="Add to Playlist"
          description={`Select a playlist for the ${selectedIds.size} selected songs.`}
          onCancel={() => setPlaylistModal(false)}
        >
          <div className="playlist-selection-grid" style={{ maxHeight: 300, overflowY: 'auto', marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {selectionPlaylists.map(p => (
              <div
                key={p.id}
                className="context-menu__item"
                style={{ borderRadius: 8, padding: '12px', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', gap: 10 }}
                onClick={() => addToPlaylist(p)}
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
}
