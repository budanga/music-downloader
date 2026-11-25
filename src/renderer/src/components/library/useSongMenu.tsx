import React, { useEffect, useState } from 'react'
import type { Playlist, Song } from '../../../../shared/types'
import { SPECIAL_PLAYLISTS } from '../../../../shared/constants'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'
import { CreatePlaylistModal } from '../ui/CreatePlaylistModal'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'

interface Options {
  /** Adds a destructive "delete" item for the selected songs. */
  onDelete?: (songs: Song[]) => void
}

/**
 * Context menu for one or more songs: play next, queue, add to a playlist (existing or new)
 * and, optionally, delete. Returns `open` and the element to render once in the page.
 */
export function useSongMenu({ onDelete }: Options = {}) {
  const playlists = useLibraryStore((s) => s.playlists)
  const { show } = useToast()
  const [menu, setMenu] = useState<{ x: number; y: number; songs: Song[] } | null>(null)
  const [pickFor, setPickFor] = useState<Song[] | null>(null)
  const [createFor, setCreateFor] = useState<Song[] | null>(null)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
    }
  }, [menu])

  const open = (e: React.MouseEvent, songs: Song[]) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 230)
    const y = Math.min(e.clientY, window.innerHeight - 320)
    setMenu({ x, y, songs })
  }

  const userLists = playlists.filter((p) => p.id !== SPECIAL_PLAYLISTS.LIKED_SONGS)
  const addTo = async (p: Playlist, songs: Song[]) => {
    for (const s of songs) await window.api.playlists.addSong(p.id, s.id)
    window.api.playlists.list().then(useLibraryStore.getState().setPlaylists)
    show(`Agregado a «${p.name}»`, 'success')
  }
  const count = (songs: Song[]) => (songs.length > 1 ? ` (${songs.length})` : '')

  const element = (
    <>
      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
          role="menu"
        >
          <button
            className="context-menu__item"
            onClick={() => {
              usePlayerStore.getState().playNextMany(menu.songs)
              show('Suena a continuación', 'success')
              setMenu(null)
            }}
          >
            Reproducir a continuación{count(menu.songs)}
          </button>
          <button
            className="context-menu__item"
            onClick={() => {
              usePlayerStore.getState().addManyToQueue(menu.songs)
              show('Agregado a la cola', 'success')
              setMenu(null)
            }}
          >
            Agregar a la cola{count(menu.songs)}
          </button>
          <div className="context-menu__sep" />
          <div className="context-menu__label">Agregar a una lista</div>
          <button
            className="context-menu__item"
            onClick={() => {
              setCreateFor(menu.songs)
              setMenu(null)
            }}
          >
            + Nueva lista…
          </button>
          {userLists.slice(0, 5).map((p) => (
            <button
              key={p.id}
              className="context-menu__item"
              onClick={() => {
                addTo(p, menu.songs)
                setMenu(null)
              }}
            >
              {p.name}
            </button>
          ))}
          {userLists.length > 5 && (
            <button
              className="context-menu__item"
              onClick={() => {
                setPickFor(menu.songs)
                setMenu(null)
              }}
            >
              Otra lista… <span aria-hidden="true">›</span>
            </button>
          )}
          {onDelete && (
            <>
              <div className="context-menu__sep" />
              <button
                className="context-menu__item danger"
                onClick={() => {
                  onDelete(menu.songs)
                  setMenu(null)
                }}
              >
                Eliminar del archivo{count(menu.songs)}
              </button>
            </>
          )}
        </div>
      )}

      {pickFor && (
        <Modal
          title="Agregar a una lista"
          description={
            pickFor.length > 1
              ? `${pickFor.length} canciones seleccionadas`
              : `«${pickFor[0].title}»`
          }
          onCancel={() => setPickFor(null)}
        >
          <div className="pick-list">
            {userLists.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  addTo(p, pickFor)
                  setPickFor(null)
                }}
              >
                {p.name}
                <small>{p.songCount ?? 0}</small>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {createFor && (
        <CreatePlaylistModal
          onClose={() => setCreateFor(null)}
          onCreated={async (id) => {
            for (const s of createFor) await window.api.playlists.addSong(id, s.id)
            window.api.playlists.list().then(useLibraryStore.getState().setPlaylists)
          }}
        />
      )}
    </>
  )

  return { open, element }
}
