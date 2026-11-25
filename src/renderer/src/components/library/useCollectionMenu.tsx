import React, { useEffect, useState } from 'react'
import type { Song } from '../../../../shared/types'
import { usePlayerStore } from '../../store/playerStore'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/Toast'

export interface Collection {
  name: string
  /** The songs, in play order. Can be fetched on demand (playlists). */
  songs: () => Song[] | Promise<Song[]>
  /** Adds a "rename" item (playlists) */
  rename?: () => void
  /** Adds a destructive item that asks for confirmation first */
  remove?: {
    label: string
    title: string
    description: (songs: Song[]) => string
    run: (songs: Song[]) => Promise<void> | void
  }
}

const plural = (n: number) => `${n} ${n === 1 ? 'canción' : 'canciones'}`

/**
 * Menu for a whole artist, album or playlist: play it, play it next, queue it and, optionally,
 * delete it. Returns `open` (for a right click or a ⋮ button) and the element to render once.
 */
export function useCollectionMenu() {
  const { show } = useToast()
  const [menu, setMenu] = useState<{ x: number; y: number; c: Collection } | null>(null)
  const [confirm, setConfirm] = useState<{ c: Collection; songs: Song[] } | null>(null)

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

  const open = (e: React.MouseEvent, c: Collection) => {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 230)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setMenu({ x, y, c })
  }

  /** Runs an action with the collection's songs and closes the menu */
  const act = (fn: (songs: Song[], c: Collection) => void) => async () => {
    if (!menu) return
    const c = menu.c
    setMenu(null)
    const songs = await c.songs()
    if (!songs.length && fn !== askRemove) return show(`«${c.name}» no tiene canciones`, 'error')
    fn(songs, c)
  }
  const askRemove = (songs: Song[], c: Collection) => setConfirm({ c, songs })

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
            onClick={act((songs) => usePlayerStore.getState().setQueue(songs, 0))}
          >
            Reproducir
          </button>
          <button
            className="context-menu__item"
            onClick={act((songs) => {
              usePlayerStore.getState().playNextMany(songs)
              show(`${plural(songs.length)} a continuación`, 'success')
            })}
          >
            Reproducir a continuación
          </button>
          <button
            className="context-menu__item"
            onClick={act((songs) => {
              usePlayerStore.getState().addManyToQueue(songs)
              show(`${plural(songs.length)} agregadas a la cola`, 'success')
            })}
          >
            Agregar a la cola
          </button>
          {menu.c.rename && (
            <>
              <div className="context-menu__sep" />
              <button
                className="context-menu__item"
                onClick={() => {
                  menu.c.rename?.()
                  setMenu(null)
                }}
              >
                Cambiar nombre…
              </button>
            </>
          )}
          {menu.c.remove && (
            <>
              <div className="context-menu__sep" />
              <button className="context-menu__item danger" onClick={act(askRemove)}>
                {menu.c.remove.label}
              </button>
            </>
          )}
        </div>
      )}

      {confirm?.c.remove && (
        <Modal
          title={confirm.c.remove.title}
          description={confirm.c.remove.description(confirm.songs)}
          confirmText="Eliminar"
          danger
          onConfirm={async () => {
            const { c, songs } = confirm
            setConfirm(null)
            await c.remove!.run(songs)
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  )

  return { open, element }
}
