import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Song } from '../../../../shared/types'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import { formatTime } from '../../hooks/useAudioPlayer'
import { totalDuration } from '../layout/scroll'
import { AsciiSpectrum } from '../motion/Motion'
import { XIcon } from '../ui/icons'

/**
 * Side panel with the queue in play order: the playing song is highlighted and the ones that
 * already played are greyed out. Rows can be dragged to reorder, or dropped outside the panel
 * to take them out of the queue.
 */
export default function QueuePanel() {
  const { queueOpen, setQueueOpen } = useUiStore()
  const q = usePlayerStore(
    useShallow((s) => ({
      queue: s.queue,
      currentIndex: s.currentIndex,
      currentSong: s.currentSong,
      jumpTo: s.jumpTo,
      togglePlay: s.togglePlay,
      removeFromQueue: s.removeFromQueue,
      moveInQueue: s.moveInQueue,
      clearUpcoming: s.clearUpcoming
    }))
  )
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<{ index: number; after: boolean } | null>(null)
  const [outside, setOutside] = useState(false)
  const panel = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!queueOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setQueueOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queueOpen, setQueueOpen])

  const current = q.currentSong ? q.currentIndex : -1

  // Keep the playing song in view as the highlight moves
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => {
    body.current?.querySelector('.qrow.on')?.scrollIntoView({ block: 'nearest' })
  }, [queueOpen, current])

  // While a row is dragged, the rest of the window accepts the drop: dropping there removes it
  useEffect(() => {
    if (dragFrom === null) return
    const reset = () => {
      setDragFrom(null)
      setOver(null)
      setOutside(false)
    }
    const inPanel = (t: EventTarget | null) => t instanceof Node && !!panel.current?.contains(t)
    const onOver = (e: DragEvent) => {
      if (inPanel(e.target)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      setOutside(true)
      setOver(null)
    }
    const onDrop = (e: DragEvent) => {
      if (inPanel(e.target)) return
      e.preventDefault()
      // The playing song stays (like its row, which has no remove button)
      const s = usePlayerStore.getState()
      if (dragFrom !== s.currentIndex) s.removeFromQueue(dragFrom)
      // The removed row unmounts, so its own dragend never reaches us: end the drag here,
      // or the song that takes its place would stay marked
      reset()
    }
    // Fallback for any drag that ends without a drop we handled (Escape, unmounted row…)
    const onEnd = () => reset()
    document.addEventListener('dragover', onOver)
    document.addEventListener('drop', onDrop)
    document.addEventListener('dragend', onEnd)
    return () => {
      document.removeEventListener('dragover', onOver)
      document.removeEventListener('drop', onDrop)
      document.removeEventListener('dragend', onEnd)
    }
  }, [dragFrom])

  if (!queueOpen) return null

  const left = q.queue.slice(current + 1).reduce((t, s) => t + s.duration, 0)

  const endDrag = () => {
    setDragFrom(null)
    setOver(null)
    setOutside(false)
  }

  const row = (song: Song, i: number) => {
    const isCurrent = i === current
    const mark =
      dragFrom !== null && over?.index === i && i !== dragFrom
        ? over.after
          ? ' drop-after'
          : ' drop-before'
        : ''
    const cls = [
      'qrow',
      isCurrent ? 'on' : i < current ? 'past' : '',
      dragFrom === i ? (outside && !isCurrent ? 'removing' : 'dragging') : ''
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div
        key={`${i}-${song.id}`}
        className={cls + mark}
        role="button"
        tabIndex={0}
        draggable
        onClick={() => (isCurrent ? q.togglePlay() : q.jumpTo(i))}
        onKeyDown={(e) => e.key === 'Enter' && (isCurrent ? q.togglePlay() : q.jumpTo(i))}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move'
          e.dataTransfer.setData('text/plain', song.id)
          setDragFrom(i)
        }}
        onDragOver={(e) => {
          if (dragFrom === null) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          setOutside(false)
          const r = e.currentTarget.getBoundingClientRect()
          const after = e.clientY > r.top + r.height / 2
          if (over?.index !== i || over.after !== after) setOver({ index: i, after })
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragFrom !== null && over) {
            // Final index once the dragged song has been taken out of its place
            let to = over.index + (over.after ? 1 : 0)
            if (to > dragFrom) to--
            q.moveInQueue(dragFrom, to)
          }
          endDrag()
        }}
        onDragEnd={endDrag}
      >
        <span className="n">
          {isCurrent ? <AsciiSpectrum bands={3} /> : String(i + 1).padStart(2, '0')}
        </span>
        <span className="t">
          <b>{song.title}</b>
          <span>{song.artistName ?? 'Artista desconocido'}</span>
        </span>
        <span className="d">{formatTime(song.duration)}</span>
        {!isCurrent && (
          <button
            className="ib"
            title="Quitar de la cola"
            aria-label="Quitar de la cola"
            onClick={(e) => {
              e.stopPropagation()
              q.removeFromQueue(i)
            }}
          >
            <XIcon />
          </button>
        )}
      </div>
    )
  }

  const dragHint =
    dragFrom === null
      ? null
      : dragFrom === current
        ? 'Movela a otro lugar de la cola'
        : 'Soltala afuera para quitarla'

  return (
    <aside
      ref={panel}
      className={`queue${dragFrom !== null ? ' is-dragging' : ''}`}
      aria-label="Cola de reproducción"
      onDragOver={(e) => dragFrom !== null && e.preventDefault()}
    >
      <header className="queue__head">
        <div>
          <h2>Cola</h2>
          <span className="mono">
            {dragHint ?? (
              <>
                {q.queue.length} {q.queue.length === 1 ? 'canción' : 'canciones'}
                {left > 0 && ` · quedan ${totalDuration(left)}`}
              </>
            )}
          </span>
        </div>
        <div className="queue__actions">
          {current < q.queue.length - 1 && (
            <button
              className="btn ghost sm"
              onClick={q.clearUpcoming}
              title="Quitar las canciones que vienen después de la actual"
            >
              Vaciar
            </button>
          )}
          <button className="ib" onClick={() => setQueueOpen(false)} aria-label="Cerrar la cola">
            <XIcon />
          </button>
        </div>
      </header>

      <div className="queue__body" ref={body}>
        {current === -1 ? (
          <p className="queue__empty">La cola está vacía. Tocá una canción para empezar.</p>
        ) : (
          // One fixed list in play order: only the highlight moves
          q.queue.map(row)
        )}
      </div>
    </aside>
  )
}
