import React from 'react'

interface HeartButtonProps {
  isFavorite: boolean
  onClick: (e: React.MouseEvent) => void
  size?: number
  className?: string
}

export const HeartIcon = ({ filled, size = 18 }: { filled: boolean; size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={filled ? 'currentColor' : 'none'}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transition: 'fill 0.2s, stroke 0.2s' }}
  >
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
)

export default function HeartButton({ isFavorite, onClick, size = 18, className = '' }: HeartButtonProps) {
  return (
    <button
      className={`heart-btn ${isFavorite ? 'active' : ''} ${className}`}
      onClick={onClick}
      title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
      style={{
        background: 'none',
        border: 'none',
        padding: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HeartIcon filled={isFavorite} size={size} />
    </button>
  )
}
