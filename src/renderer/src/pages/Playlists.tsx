import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLibraryStore } from '../store/libraryStore'
import { usePlayerStore } from '../store/playerStore'
import { useToast } from '../components/ui/Toast'
import { Modal } from '../components/ui/Modal'
import { CreatePlaylistModal } from '../components/ui/CreatePlaylistModal'
import { RenamePlaylistModal } from '../components/ui/RenamePlaylistModal'
import { DotsIcon, PlayIcon, PlusIcon, TrashIcon, XIcon } from '../components/ui/icons'
import { useCollectionMenu, type Collection } from '../components/library/useCollectionMenu'
import SectionCover from '../components/layout/SectionCover'
import { totalDuration } from '../components/layout/scroll'
import { TrackList } from '../components/library/TrackList'
import { ART, asciiStrip, coverFn } from '../components/motion/art'
import type { Playlist, PlaylistSong } from '../../../shared/types'
import { SPECIAL_PLAYLISTS } from '../../../shared/constants'

const isLiked = (p: Playlist) => p.id === SPECIAL_PLAYLISTS.LIKED_SONGS
const nameOf = (p: Playlist) => (isLiked(p) ? 'Me gusta' : p.name)

export default function PlaylistsPage() {
  const { playlists, removePlaylist, setPlaylists } = useLibraryStore()
  const setQueue = usePlayerStore((s) => s.setQueue)
  const { show } = useToast()

  // The open playlist lives in the URL (/playlists/:id), so the sidebar link always leads back
  // to the index cards
  const { id: selectedId } = useParams()
  const navigate = useNavigate()
  const selected = playlists.find((p) => p.id === selectedId) ?? null
  const [songs, setSongs] = useState<PlaylistSong[]>([])
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Playlist | null>(null)
  const [renaming, setRenaming] = useState<Playlist | null>(null)

  // Counts change outside this page (downloads, menus elsewhere): reload them on entry
  useEffect(() => {
    window.api.playlists.list().then(setPlaylists)
  }, [setPlaylists])

  useEffect(() => {
    if (!selectedId) return
    let current = true
    window.api.playlists.getSongs(selectedId).then((s) => current && setSongs(s))
    return () => {
      current = false
    }
  }, [selectedId])

  // Liked songs first, then the rest as they come
  const sorted = [...playlists].sort((a, b) => Number(isLiked(b)) - Number(isLiked(a)))

  const openPlaylist = (pl: Playlist | null) => {
    setSongs([])
    navigate(pl ? `/playlists/${pl.id}` : '/playlists')
  }

  const removeList = async (pl: Playlist) => {
    await window.api.playlists.delete(pl.id)
    removePlaylist(pl.id)
    if (selectedId === pl.id) navigate('/playlists')
    show(`Lista «${pl.name}» eliminada`, 'success')
  }
  const deletePlaylist = async () => {
    if (!toDelete) return
    await removeList(toDelete)
    setToDelete(null)
  }

  const menu = useCollectionMenu()
  const collection = (pl: Playlist): Collection => ({
    name: nameOf(pl),
    songs: () => (pl.id === selectedId ? songs : window.api.playlists.getSongs(pl.id)),
    rename: isLiked(pl) ? undefined : () => setRenaming(pl),
    remove: isLiked(pl)
      ? undefined
      : {
          label: 'Eliminar lista',
          title: 'Eliminar lista',
          description: () =>
            `La lista «${pl.name}» se elimina. Las canciones siguen en el archivo.`,
          run: () => removeList(pl)
        }
  })

  if (selected) {
    return (
      <div>
        <SectionCover
          title={nameOf(selected)}
          art={coverFn(nameOf(selected))}
          onBack={() => openPlaylist(null)}
          backLabel="Listas"
          pills={[
            [songs.length, 'canciones'],
            [totalDuration(songs.reduce((t, s) => t + s.duration, 0)), '']
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
            {!isLiked(selected) && (
              <button className="btn ghost sm" onClick={() => setToDelete(selected)}>
                <TrashIcon /> Eliminar lista
              </button>
            )}
            <button className="btn" disabled={!songs.length} onClick={() => setQueue(songs, 0)}>
              <PlayIcon /> Escuchar lista
            </button>
          </div>
        </div>
        <TrackList
          songs={songs}
          onReorder={async (from, to) => {
            const moved = songs[from]
            const next = [...songs]
            next.splice(to, 0, next.splice(from, 1)[0])
            setSongs(next)
            try {
              await window.api.playlists.reorder(selected.id, moved.id, to)
            } catch (e) {
              console.error(e)
              show('No se pudo mover la canción', 'error')
              setSongs(await window.api.playlists.getSongs(selected.id))
            }
          }}
          empty={
            <div className="card empty">
              <b>La lista está vacía</b>
              {isLiked(selected)
                ? 'Marcá canciones con el corazón y aparecen acá.'
                : 'Agregá canciones desde el menú ⋮ de cualquier lista.'}
            </div>
          }
          onFavorite={(song) =>
            window.api.library.toggleFavorite(song.id).then((updated) => {
              if (isLiked(selected) && updated && !updated.isFavorite)
                setSongs((s) => s.filter((x) => x.id !== song.id))
              else if (updated)
                setSongs((s) =>
                  s.map((x) => (x.id === song.id ? { ...x, isFavorite: updated.isFavorite } : x))
                )
            })
          }
          extra={(song) =>
            isLiked(selected) ? null : (
              <button
                className="ib"
                title="Quitar de la lista"
                aria-label="Quitar de la lista"
                onClick={async () => {
                  await window.api.playlists.removeSong(selected.id, song.id)
                  setSongs((s) => s.filter((x) => x.id !== song.id))
                }}
              >
                <XIcon />
              </button>
            )
          }
        />
        {menu.element}
        {renaming && <RenamePlaylistModal playlist={renaming} onClose={() => setRenaming(null)} />}
        {toDelete && (
          <Modal
            title="Eliminar lista"
            description={`La lista «${toDelete.name}» se elimina. Las canciones siguen en el archivo.`}
            confirmText="Eliminar"
            danger
            onConfirm={deletePlaylist}
            onCancel={() => setToDelete(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div>
      <SectionCover title="Listas" art={ART.playlists} pills={[[playlists.length, 'listas']]} />
      <div className="bar">
        <h2>Tus listas</h2>
        <button className="btn" onClick={() => setCreating(true)}>
          <PlusIcon /> Nueva lista
        </button>
      </div>
      <div className="idx">
        {sorted.map((pl, i) => (
          <div
            key={pl.id}
            className="icard"
            role="button"
            tabIndex={0}
            onClick={() => openPlaylist(pl)}
            onKeyDown={(e) => e.key === 'Enter' && openPlaylist(pl)}
            onContextMenu={(e) => menu.open(e, collection(pl))}
          >
            <span className="code">FICHA {String(i + 1).padStart(2, '0')}</span>
            <h3>
              {isLiked(pl) ? '♥ ' : ''}
              {nameOf(pl)}
            </h3>
            <p>
              {pl.songCount ?? 0} {pl.songCount === 1 ? 'canción' : 'canciones'}
            </p>
            <pre aria-hidden="true">{asciiStrip(nameOf(pl))}</pre>
            {pl.thumbnail && !isLiked(pl) && (
              <img className="icard__thumb" src={pl.thumbnail} alt="" />
            )}
            <button
              className="ib icard__del"
              title="Más opciones"
              aria-label={`Más opciones para ${nameOf(pl)}`}
              onClick={(e) => menu.open(e, collection(pl))}
            >
              <DotsIcon />
            </button>
          </div>
        ))}
      </div>

      {menu.element}
      {renaming && <RenamePlaylistModal playlist={renaming} onClose={() => setRenaming(null)} />}
      {creating && <CreatePlaylistModal onClose={() => setCreating(false)} />}
      {toDelete && (
        <Modal
          title="Eliminar lista"
          description={`La lista «${toDelete.name}» se elimina. Las canciones siguen en el archivo.`}
          confirmText="Eliminar"
          danger
          onConfirm={deletePlaylist}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
