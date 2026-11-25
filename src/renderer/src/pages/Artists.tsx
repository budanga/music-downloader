import { useNavigate, useParams } from 'react-router-dom'
import { useShallow } from 'zustand/react/shallow'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import type { Artist } from '../../../shared/types'
import SectionCover from '../components/layout/SectionCover'
import { totalDuration } from '../components/layout/scroll'
import { TrackList } from '../components/library/TrackList'
import { ART, coverFn } from '../components/motion/art'
import { DitherCanvas } from '../components/motion/Motion'
import { DotsIcon, PlayIcon } from '../components/ui/icons'
import { useToast } from '../components/ui/Toast'
import { deleteSongs } from '../components/library/deleteSongs'
import { useCollectionMenu, type Collection } from '../components/library/useCollectionMenu'

export default function ArtistsPage() {
  const { artists, albums, songs } = useLibraryStore(
    useShallow((s) => ({ artists: s.artists, albums: s.albums, songs: s.songs }))
  )
  const setQueue = usePlayerStore((s) => s.setQueue)
  // The open artist lives in the URL (/artists/:id), so the sidebar link always leads back to the grid
  const { id: selectedId } = useParams()
  const navigate = useNavigate()
  const selected = artists.find((a) => a.id === selectedId) ?? null

  const open = (a: Artist | null) => {
    navigate(a ? `/artists/${a.id}` : '/artists')
  }
  const menu = useCollectionMenu()
  const { show } = useToast()
  const collection = (a: Artist): Collection => ({
    name: a.name,
    songs: () => songsOf(a.id),
    remove: {
      label: 'Eliminar artista',
      title: `Eliminar «${a.name}»`,
      description: (list) =>
        list.length
          ? `Se borran ${list.length === 1 ? 'su canción' : `sus ${list.length} canciones`} del archivo y del disco. No se puede deshacer.`
          : 'Este artista ya no tiene canciones: se quita del archivo.',
      run: async (list) => {
        await deleteSongs(list)
        if (selectedId === a.id) navigate('/artists')
        show(`«${a.name}» eliminado`, 'success')
      }
    }
  })
  const songsOf = (id: string) => songs.filter((s) => s.artistId === id)

  if (selected) {
    const list = songsOf(selected.id)
    return (
      <div>
        <SectionCover
          title={selected.name}
          art={coverFn(selected.name, true)}
          onBack={() => open(null)}
          backLabel="Artistas"
          pills={[
            [list.length, 'canciones'],
            [totalDuration(list.reduce((t, s) => t + s.duration, 0)), '']
          ]}
        />
        <div className="bar">
          <h2>Canciones</h2>
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
              <PlayIcon /> Escuchar todo
            </button>
          </div>
        </div>
        <TrackList
          songs={list}
          empty={<div className="card empty">Este artista ya no tiene canciones.</div>}
        />
        {menu.element}
      </div>
    )
  }

  return (
    <div>
      <SectionCover
        title="Artistas"
        art={ART.artists}
        pills={[
          [artists.length, 'artistas'],
          [albums.length, 'discos']
        ]}
      />
      {artists.length === 0 ? (
        <div className="card empty">
          <b>Todavía no hay artistas</b>
          Aparecen solos cuando descargás música.
        </div>
      ) : (
        <div className="tiles">
          {artists.map((artist) => (
            <div
              key={artist.id}
              className="tile"
              role="button"
              tabIndex={0}
              onClick={() => open(artist)}
              onKeyDown={(e) => e.key === 'Enter' && open(artist)}
              onContextMenu={(e) => menu.open(e, collection(artist))}
            >
              <div className="tile__art">
                <DitherCanvas field={coverFn(artist.name, true)} px={3} />
                <button
                  className="ib tile__menu"
                  title="Más opciones"
                  aria-label={`Más opciones para ${artist.name}`}
                  onClick={(e) => menu.open(e, collection(artist))}
                >
                  <DotsIcon />
                </button>
                <button
                  className="tile__play"
                  aria-label={`Escuchar ${artist.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    const list = songsOf(artist.id)
                    if (list.length) setQueue(list, 0)
                  }}
                >
                  <PlayIcon />
                </button>
              </div>
              <h3>{artist.name}</h3>
              <p>
                {artist.songCount ?? 0} {artist.songCount === 1 ? 'canción' : 'canciones'}
              </p>
            </div>
          ))}
        </div>
      )}
      {menu.element}
    </div>
  )
}
