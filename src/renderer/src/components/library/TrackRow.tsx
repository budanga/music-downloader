import React from 'react'
import type { Song } from '../../../../shared/types'
import { formatTime } from '../../hooks/useAudioPlayer'
import { usePlayerStore } from '../../store/playerStore'
import { AsciiSpectrum } from '../motion/Motion'
import HeartButton from '../ui/HeartButton'
import { DotsIcon, QueueIcon } from '../ui/icons'
import { useToast } from '../ui/Toast'

interface TrackRowProps {
  song: Song
  /** Shown in the first column while the song is not playing */
  number: number
  active: boolean
  selected?: boolean
  onClick: (e: React.MouseEvent) => void
  onMenu?: (e: React.MouseEvent) => void
  onFavorite?: (song: Song) => void
  /** Extra action buttons (e.g. remove from playlist) */
  extra?: React.ReactNode
  style?: React.CSSProperties
  /** Drag-and-drop handlers; makes the row draggable */
  drag?: React.HTMLAttributes<HTMLDivElement>
  /** Where a dragged row would land relative to this one */
  dropMark?: 'before' | 'after' | null
  dragging?: boolean
}

export function TrackRow({
  song,
  number,
  active,
  selected,
  onClick,
  onMenu,
  onFavorite,
  extra,
  style,
  drag,
  dropMark,
  dragging
}: TrackRowProps) {
  const { show } = useToast()
  const cls = [
    'tr',
    active && 'on',
    selected && !active && 'selected',
    drag && 'draggable',
    dragging && 'dragging',
    dropMark && `drop-${dropMark}`
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      style={style}
      onClick={onClick}
      onContextMenu={onMenu}
      onDoubleClick={(e) => e.preventDefault()}
      draggable={!!drag}
      {...drag}
    >
      <span className="n">
        {active ? (
          <AsciiSpectrum bands={3} />
        ) : (
          <span className="num">{String(number).padStart(2, '0')}</span>
        )}
        {drag && (
          <span className="grip" title="Arrastrar para mover" aria-hidden="true">
            ⠿
          </span>
        )}
      </span>
      <span className="t">
        <b>{song.title}</b>
        <span>{song.artistName ?? 'Artista desconocido'}</span>
      </span>
      <span className="al">{song.albumTitle ?? '—'}</span>
      <span className="d">{formatTime(song.duration)}</span>
      <span className="acts" onClick={(e) => e.stopPropagation()}>
        <HeartButton
          isFavorite={song.isFavorite}
          onClick={() =>
            onFavorite ? onFavorite(song) : window.api.library.toggleFavorite(song.id)
          }
        />
        <button
          className="ib"
          title="Agregar a la cola"
          aria-label="Agregar a la cola"
          onClick={() => {
            usePlayerStore.getState().addToQueue(song)
            show('Agregado a la cola', 'success')
          }}
        >
          <QueueIcon />
        </button>
        {extra}
        {onMenu && (
          <button className="ib" title="Más opciones" aria-label="Más opciones" onClick={onMenu}>
            <DotsIcon />
          </button>
        )}
      </span>
    </div>
  )
}

export function TrackHead() {
  return (
    <div className="tr thead">
      <span className="n">#</span>
      <span>Título</span>
      <span className="al">Disco</span>
      <span className="d">Dur.</span>
      <span />
    </div>
  )
}
