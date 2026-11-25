import React from 'react'
import { HeartIcon } from './icons'

interface HeartButtonProps {
  isFavorite: boolean
  onClick: (e: React.MouseEvent) => void
}

export default function HeartButton({ isFavorite, onClick }: HeartButtonProps) {
  return (
    <button
      className={`ib fill${isFavorite ? ' on' : ''}`}
      onClick={onClick}
      title={isFavorite ? 'Quitar de Me gusta' : 'Agregar a Me gusta'}
      aria-label={isFavorite ? 'Quitar de Me gusta' : 'Agregar a Me gusta'}
      aria-pressed={isFavorite}
    >
      <HeartIcon />
    </button>
  )
}
