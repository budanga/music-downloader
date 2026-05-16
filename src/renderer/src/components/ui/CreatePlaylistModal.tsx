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

  const handleImageClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validations: Type and Size
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!validTypes.includes(file.type)) {
      show('Please select a valid image (JPEG, PNG, or WEBP)', 'error')
      return
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      show('Image is too large (max 5MB)', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      setThumbnail(event.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleCreate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    if (playlists.some(p => p.name.toLowerCase() === trimmedName.toLowerCase())) {
      show('A playlist with this name already exists', 'error')
      return
    }

    try {
      const p = await window.api.playlists.create(trimmedName, '', thumbnail || undefined)
      addPlaylist(p)
      show(`Playlist "${p.name}" created`, 'success')
      onCreated?.(p.id)
      onClose()
    } catch (e) {
      console.error(e)
      show('Failed to create playlist', 'error')
    }
  }

  return (
    <Modal
      title="Create New Playlist"
      onConfirm={handleCreate}
      onCancel={onClose}
      confirmText="Create"
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginTop: 10 }}>
        {/* Large Image Upload Area */}
        <div 
          onClick={handleImageClick}
          style={{
            width: 200,
            height: 200,
            background: 'var(--bg-overlay)',
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            border: '2px dashed var(--border)',
            transition: 'border-color 0.2s',
            position: 'relative'
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          {thumbnail ? (
            <img src={thumbnail} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>🖼️</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Import Photo</div>
            </div>
          )}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        {/* Name Input */}
        <div style={{ width: '100%' }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
            Playlist Name
          </label>
          <input
            className="input"
            autoFocus
            placeholder="Give your playlist a name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            style={{ width: '100%' }}
          />
        </div>
      </div>
    </Modal>
  )
}
