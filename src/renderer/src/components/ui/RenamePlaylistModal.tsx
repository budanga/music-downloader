import { useState } from 'react'
import type { Playlist } from '../../../../shared/types'
import { useLibraryStore } from '../../store/libraryStore'
import { Modal } from './Modal'
import { useToast } from './Toast'

export function RenamePlaylistModal({
  playlist,
  onClose
}: {
  playlist: Playlist
  onClose: () => void
}) {
  const { show } = useToast()
  const [name, setName] = useState(playlist.name)

  const save = async () => {
    const trimmed = name.trim()
    if (!trimmed) return show('Escribí un nombre para la lista', 'error')
    if (trimmed === playlist.name) return onClose()
    const { playlists, setPlaylists } = useLibraryStore.getState()
    if (
      playlists.some((p) => p.id !== playlist.id && p.name.toLowerCase() === trimmed.toLowerCase())
    )
      return show('Ya hay una lista con ese nombre', 'error')
    try {
      await window.api.playlists.update(playlist.id, { name: trimmed })
      setPlaylists(await window.api.playlists.list())
      show(`Lista renombrada a «${trimmed}»`, 'success')
      onClose()
    } catch (e) {
      console.error(e)
      show('No se pudo cambiar el nombre', 'error')
    }
  }

  return (
    <Modal title="Cambiar nombre" onConfirm={save} onCancel={onClose} confirmText="Guardar">
      <label className="label" htmlFor="rename-playlist">
        Nombre
      </label>
      <input
        id="rename-playlist"
        className="field"
        style={{ width: '100%' }}
        autoFocus
        onFocus={(e) => e.currentTarget.select()}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
    </Modal>
  )
}
