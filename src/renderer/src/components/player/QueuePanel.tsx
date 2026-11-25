import { useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Song } from '../../../../shared/types'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import { formatTime } from '../../hooks/useAudioPlayer'
import { totalDuration } from '../layout/scroll'
import { AsciiSpectrum } from '../motion/Motion'
import { XIcon } from '../ui/icons'

/** Side panel with the current queue: what's playing, what comes next and what already played. */
export default function QueuePanel() {
  const { queueOpen, setQueueOpen } = useUiStore()
  const q = usePlayerStore(
    useShallow((s) => ({
      queue: s.queue,
      currentIndex: s.currentIndex,
      currentSong: s.currentSong,
      isShuffle: s.isShuffle,
      jumpTo: s.jumpTo,
      togglePlay: s.togglePlay,
      removeFromQueue: s.removeFromQueue,
      clearUpcoming: s.clearUpcoming
    }))
  )

  useEffect(() => {
    if (!queueOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setQueueOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [queueOpen, setQueueOpen])

  if (!queueOpen) return null

  const current = q.currentSong ? q.currentIndex : -1
  const upcoming = q.queue.slice(current + 1)
  const past = current > 0 ? q.queue.slice(0, current) : []
  const left = upcoming.reduce((t, s) => t + s.duration, 0)

  const row = (song: Song, i: number, cls = '') => (
    <div
      key={`${i}-${song.id}`}
      className={`qrow ${cls}`}
      role="button"
      tabIndex={0}
      onClick={() => (i === current ? q.togglePlay() : q.jumpTo(i))}
      onKeyDown={(e) => e.key === 'Enter' && (i === current ? q.togglePlay() : q.jumpTo(i))}
    >
      <span className="n">
        {i === current ? <AsciiSpectrum bands={3} /> : String(i + 1).padStart(2, '0')}
      </span>
      <span className="t">
        <b>{song.title}</b>
        <span>{song.artistName ?? 'Artista desconocido'}</span>
      </span>
      <span className="d">{formatTime(song.duration)}</span>
      {i !== current && (
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

  return (
    <aside className="queue" aria-label="Cola de reproducción">
      <header className="queue__head">
        <div>
          <h2>Cola</h2>
          <span className="mono">
            {q.queue.length} {q.queue.length === 1 ? 'canción' : 'canciones'}
            {left > 0 && ` · quedan ${totalDuration(left)}`}
          </span>
        </div>
        <button className="ib" onClick={() => setQueueOpen(false)} aria-label="Cerrar la cola">
          <XIcon />
        </button>
      </header>

      <div className="queue__body">
        {current === -1 ? (
          <p className="queue__empty">La cola está vacía. Tocá una canción para empezar.</p>
        ) : (
          <>
            <h3>Sonando</h3>
            {row(q.queue[current], current, 'on')}

            <div className="queue__sub">
              <h3>A continuación{q.isShuffle && <small> · en orden aleatorio</small>}</h3>
              {upcoming.length > 0 && (
                <button className="btn ghost sm" onClick={q.clearUpcoming}>
                  Vaciar
                </button>
              )}
            </div>
            {upcoming.length ? (
              upcoming.map((s, k) => row(s, current + 1 + k))
            ) : (
              <p className="queue__empty">No hay más canciones en la cola.</p>
            )}

            {past.length > 0 && (
              <>
                <h3>Ya sonaron</h3>
                {past.map((s, i) => row(s, i, 'past'))}
              </>
            )}
          </>
        )}
      </div>
    </aside>
  )
}
