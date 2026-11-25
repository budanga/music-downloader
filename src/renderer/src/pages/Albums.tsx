import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import type { Album, Song } from '../../../shared/types'
import SectionCover from '../components/layout/SectionCover'
import { totalDuration } from '../components/layout/scroll'
import { TrackList } from '../components/library/TrackList'
import { ART, coverFn } from '../components/motion/art'
import { DitherCanvas } from '../components/motion/Motion'
import { DotsIcon, PlayIcon } from '../components/ui/icons'
import { useToast } from '../components/ui/Toast'
import { deleteSongs } from '../components/library/deleteSongs'
import { useCollectionMenu, type Collection } from '../components/library/useCollectionMenu'

const byTrack = (a: Song, b: Song) => (a.trackNumber ?? 999) - (b.trackNumber ?? 999)

export default function AlbumsPage() {
  const { albums, songs } = useLibraryStore(
    useShallow((s) => ({ albums: s.albums, songs: s.songs }))
  )
  const setQueue = usePlayerStore((s) => s.setQueue)
  // The open album lives in the URL (/albums/:id), so the sidebar link always leads back to the grid
  const { id: selectedId } = useParams()
  const navigate = useNavigate()
  const selected = albums.find((a) => a.id === selectedId) ?? null

  const open = (a: Album | null) => {
    navigate(a ? `/albums/${a.id}` : '/albums')
  }
  const menu = useCollectionMenu()
  const { show } = useToast()
  const collection = (a: Album): Collection => ({
    name: a.title,
    songs: () => songsOf(a.id),
    remove: {
      label: 'Eliminar disco',
      title: `Eliminar «${a.title}»`,
      description: (list) =>
        list.length
          ? `Se borran ${list.length === 1 ? 'su canción' : `sus ${list.length} canciones`} del archivo y del disco. No se puede deshacer.`
          : 'Este disco ya no tiene canciones: se quita del archivo.',
      run: async (list) => {
        await deleteSongs(list)
        if (selectedId === a.id) navigate('/albums')
        show(`«${a.title}» eliminado`, 'success')
      }
    }
  })
  const songsOf = (id: string) => songs.filter((s) => s.albumId === id).sort(byTrack)

  if (selected) {
    const list = songsOf(selected.id)
    return (
      <div>
        <SectionCover
          title={selected.title}
          art={coverFn(selected.title)}
          onBack={() => open(null)}
          backLabel="Discos"
          pills={[
            [list.length, 'canciones'],
            [totalDuration(list.reduce((t, s) => t + s.duration, 0)), '']
          ]}
        />
        <div className="bar">
          <h2>Lista de canciones</h2>
          <div className="bar__actions">
            <button
              className="ib"
              title="Más opciones"
              aria-label="Más opciones"
              onClick={(e) => menu.open(e, collection(selected))}
            >
              <DotsIcon />
            </button>
            <button className="btn" disabled={!list.length} onClick={() => setQueue(list, 0)}>
              <PlayIcon /> Escuchar disco
            </button>
          </div>
        </div>
        <TrackList
          songs={list}
          numberOf={(s, i) => s.trackNumber || i + 1}
          empty={<div className="card empty">Este disco ya no tiene canciones.</div>}
        />
        {menu.element}
      </div>
    )
  }

  return (
    <div>
      <SectionCover
        title="Discos"
        art={ART.albums}
        pills={[
          [albums.length, 'discos'],
          [songs.length, 'canciones']
        ]}
      />
      {albums.length === 0 ? (
        <div className="card empty">
          <b>Todavía no hay discos</b>
          Aparecen solos cuando descargás música.
        </div>
      ) : (
        <div className="tiles">
          {albums.map((album) => (
            <div
              key={album.id}
              className="tile"
              role="button"
              tabIndex={0}
              onClick={() => open(album)}
              onKeyDown={(e) => e.key === 'Enter' && open(album)}
              onContextMenu={(e) => menu.open(e, collection(album))}
            >
              <div className="tile__art">
                <DitherCanvas field={coverFn(album.title)} px={3} />
                <button
                  className="ib tile__menu"
                  title="Más opciones"
                  aria-label={`Más opciones para ${album.title}`}
                  onClick={(e) => menu.open(e, collection(album))}
                >
                  <DotsIcon />
                </button>
                <button
                  className="tile__play"
                  aria-label={`Escuchar ${album.title}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const list = songsOf(album.id)
                    if (list.length) setQueue(list, 0)
                  }}
                >
                  <PlayIcon />
                </button>
              </div>
              <h3>{album.title}</h3>
              <p>{[album.artistName, album.year].filter(Boolean).join(' · ')}</p>
            </div>
          ))}
        </div>
      )}
      {menu.element}
    </div>
  )
}
