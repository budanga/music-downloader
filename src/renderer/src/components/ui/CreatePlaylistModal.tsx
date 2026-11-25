import React, { useState, useRef } from 'react'
import { Modal } from './Modal'
import { useLibraryStore } from '../../store/libraryStore'
import { useToast } from './Toast'

interface CreatePlaylistModalProps {
  onClose: () => void
  onCreated?: (playlistId: string) => void
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({ onClose, onCreated }) => {
  const { playlists, addPlaylist } = useLibraryStore()
  const { show } = useToast()

  const [name, setName] = useState('')
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      show('Elegí una imagen JPEG, PNG o WEBP', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      show('La imagen pesa más de 5 MB', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => setThumbnail(event.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      show('Escribí un nombre para la lista', 'error')
      return
    }
    if (playlists.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      show('Ya hay una lista con ese nombre', 'error')
      return
    }

    try {
      const p = await window.api.playlists.create(trimmedName, '', thumbnail || undefined)
      addPlaylist(p)
      show(`Lista «${p.name}» creada`, 'success')
      onCreated?.(p.id)
      onClose()
    } catch (e) {
      console.error(e)
      show('No se pudo crear la lista', 'error')
    }
  }

  return (
    <Modal
      title="Nueva lista"
      onConfirm={handleCreate}
      onCancel={onClose}
      confirmText="Crear lista"
    >
      <button className="upload" onClick={() => fileInputRef.current?.click()} type="button">
        {thumbnail ? (
          <img src={thumbnail} alt="Portada elegida" />
        ) : (
          <span>Elegir una imagen de portada (opcional)</span>
        )}
      </button>
      <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
      <label className="label" htmlFor="new-playlist-name">
        Nombre
      </label>
      <input
        id="new-playlist-name"
        className="field"
        style={{ width: '100%' }}
        autoFocus
        placeholder="Por ejemplo: Para correr"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
      />
    </Modal>
  )
}
