import { useState, useMemo, useRef, useEffect, useLayoutEffect, useDeferredValue } from 'react'
import { Link } from 'react-router-dom'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useShallow } from 'zustand/react/shallow'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useUiStore } from '../store/uiStore'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { FolderIcon } from '../components/ui/icons'
import SectionCover from '../components/layout/SectionCover'
import { mainScroll, totalDuration } from '../components/layout/scroll'
import { TrackHead, TrackRow } from '../components/library/TrackRow'
import { useSongMenu } from '../components/library/useSongMenu'
import { deleteSongs as removeSongs } from '../components/library/deleteSongs'
import { ART } from '../components/motion/art'
import { BrailleSpinner, DitherCanvas } from '../components/motion/Motion'
import type { Song, SortField, SortOrder } from '../../../shared/types'

const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

const SORTS: Array<[SortField, string, SortOrder]> = [
  ['dateAdded', 'Recientes', 'desc'],
  ['title', 'A–Z', 'asc'],
  ['artist', 'Artista', 'asc'],
  ['album', 'Disco', 'asc'],
  ['duration', 'Duración', 'asc'],
  ['playCount', 'Más escuchados', 'desc']
]

function compare(a: Song, b: Song, field: SortField): number {
  switch (field) {
    case 'title':
      return collator.compare(a.title, b.title)
    case 'artist':
      return collator.compare(a.artistName ?? '', b.artistName ?? '')
    case 'album':
      return collator.compare(a.albumTitle ?? '', b.albumTitle ?? '')
    case 'duration':
      return a.duration - b.duration
    case 'playCount':
      return a.playCount - b.playCount
    default:
      return a.dateAdded - b.dateAdded
  }
}

export default function SongsPage() {
  const { songs, isLoading } = useLibraryStore(
    useShallow((s) => ({ songs: s.songs, isLoading: s.isLoading }))
  )
  const { currentSong, setQueue, togglePlay } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      setQueue: s.setQueue,
      togglePlay: s.togglePlay
    }))
  )
  const { show } = useToast()
  const query = useUiStore((s) => s.query)

  const [sortField, setSortField] = useState<SortField>('dateAdded')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const deferredQuery = useDeferredValue(query)
  const [searchResults, setSearchResults] = useState<Song[] | null>(null)

  // Search runs in the main process
  useEffect(() => {
    if (!deferredQuery.trim()) {
      setSearchResults(null)
      return
    }
    window.api.library.search(deferredQuery).then(setSearchResults)
  }, [deferredQuery])

  const filtered = useMemo<Song[]>(() => {
    const list = [...(searchResults || songs)]
    if (!deferredQuery.trim()) {
      const dir = sortOrder === 'asc' ? 1 : -1
      list.sort((a, b) => dir * compare(a, b, sortField))
    }
    return list
  }, [songs, searchResults, deferredQuery, sortField, sortOrder])

  const handleSort = (field: SortField, defaultOrder: SortOrder) => {
    if (sortField === field) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSortField(field)
      setSortOrder(defaultOrder)
    }
  }

  // ─── Virtualized list inside the page scroll container ──────────────────
  const rowsRef = useRef<HTMLDivElement>(null)
  const hasRows = filtered.length > 0
  const [scrollMargin, setScrollMargin] = useState(0)
  useLayoutEffect(() => {
    const main = mainScroll()
    const rows = rowsRef.current
    if (!main || !rows) return
    const measure = () =>
      setScrollMargin(
        rows.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop
      )
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(main)
    if (main.firstElementChild) ro.observe(main.firstElementChild)
    return () => ro.disconnect()
  }, [hasRows])

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: mainScroll,
    estimateSize: () => 56,
    overscan: 10,
    scrollMargin
  })

  // ─── Selection (click, Ctrl/Cmd+click, Shift+click) ─────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const lastSelectedIndex = useRef<number | null>(null)

  const handleRowClick = (e: React.MouseEvent, index: number, song: Song) => {
    if (e.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index)
      const end = Math.max(lastSelectedIndex.current, index)
      const next = new Set(selectedIds)
      for (let i = start; i <= end; i++) next.add(filtered[i].id)
      setSelectedIds(next)
    } else if (e.ctrlKey || e.metaKey) {
      const next = new Set(selectedIds)
      if (next.has(song.id)) next.delete(song.id)
      else next.add(song.id)
      setSelectedIds(next)
      lastSelectedIndex.current = index
    } else {
      if (song.id === currentSong?.id) togglePlay()
      else setQueue(filtered, index)
      setSelectedIds(new Set([song.id]))
      lastSelectedIndex.current = index
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────
  const [toDelete, setToDelete] = useState<Song[] | null>(null)
  const deleteSongs = async (list: Song[]) => {
    setToDelete(null)
    await removeSongs(list)
    show(list.length === 1 ? 'Canción eliminada' : `${list.length} canciones eliminadas`, 'success')
    setSelectedIds(new Set())
  }

  const menu = useSongMenu({ onDelete: setToDelete })
  const openMenu = (e: React.MouseEvent, song: Song) => {
    const targets = selectedIds.has(song.id)
      ? filtered.filter((s) => selectedIds.has(s.id))
      : [song]
    if (!selectedIds.has(song.id)) setSelectedIds(new Set([song.id]))
    menu.open(e, targets)
  }

  const openFolder = async () => {
    const settings = await window.api.settings.getAll()
    const path = settings.downloadPath || (await window.api.system.getDefaultDownloadPath())
    window.api.system.openFile(path)
  }

  const liked = songs.filter((s) => s.isFavorite).length
  const total = songs.reduce((t, s) => t + s.duration, 0)

  return (
    <div>
      <SectionCover
        title="Canciones"
        art={ART.songs}
        pills={[
          [songs.length, 'canciones'],
          [totalDuration(total), 'de música'],
          [liked, 'me gusta']
        ]}
      />

      <div className="bar">
        <h2>{query.trim() ? `Resultados para «${query.trim()}»` : 'Todas las canciones'}</h2>
        <div className="bar__actions">
          {!query.trim() && (
            <div className="seg" role="group" aria-label="Ordenar">
              {SORTS.map(([field, label, order]) => (
                <button
                  key={field}
                  className={sortField === field ? 'on' : ''}
                  onClick={() => handleSort(field, order)}
                  title={
                    sortField === field ? 'Invertir el orden' : `Ordenar por ${label.toLowerCase()}`
                  }
                >
                  {label}
                  {sortField === field ? (sortOrder === 'asc' ? ' ↑' : ' ↓') : ''}
                </button>
              ))}
            </div>
          )}
          <button
            className="btn ghost sm"
            onClick={openFolder}
            title="Abrir la carpeta de descargas"
          >
            <FolderIcon />
            Carpeta
          </button>
        </div>
      </div>

      {isLoading && songs.length === 0 ? (
        <div className="card loading">
          <BrailleSpinner />
          Cargando el archivo…
        </div>
      ) : filtered.length === 0 ? (
        <div className="card empty">
          {query.trim() ? (
            <>
              <b>Nada coincide con «{query.trim()}»</b>
              Probá con otra palabra.
            </>
          ) : (
            <>
              <DitherCanvas field={ART.downloads} px={3} fine />
              <b>Todavía no hay canciones</b>
              <Link to="/downloads" style={{ color: 'var(--accent)', fontWeight: 600 }}>
                Descargá el primero →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="card tl">
          <TrackHead />
          <div ref={rowsRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((v) => {
              const song = filtered[v.index]
              return (
                <TrackRow
                  key={song.id}
                  song={song}
                  number={v.index + 1}
                  active={song.id === currentSong?.id}
                  selected={selectedIds.has(song.id)}
                  onClick={(e) => handleRowClick(e, v.index, song)}
                  onMenu={(e) => openMenu(e, song)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${v.start - scrollMargin}px)`
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {menu.element}

      {toDelete && (
        <Modal
          title={
            toDelete.length === 1 ? 'Eliminar canción' : `Eliminar ${toDelete.length} canciones`
          }
          description={
            toDelete.length === 1
              ? `«${toDelete[0].title}» se borra del archivo y del disco. No se puede deshacer.`
              : `Las ${toDelete.length} canciones seleccionadas se borran del archivo y del disco. No se puede deshacer.`
          }
          confirmText="Eliminar"
          danger
          onConfirm={() => deleteSongs(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
