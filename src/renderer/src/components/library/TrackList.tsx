import React, { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Song } from '../../../../shared/types'
import { usePlayerStore } from '../../store/playerStore'
import { TrackHead, TrackRow } from './TrackRow'
import { useSongMenu } from './useSongMenu'

interface TrackListProps {
  songs: Song[]
  /** Number shown per row; defaults to the position in the list */
  numberOf?: (song: Song, index: number) => number
  extra?: (song: Song) => React.ReactNode
  onFavorite?: (song: Song) => void
  /** Enables drag and drop. `to` is the song's final index. */
  onReorder?: (from: number, to: number) => void
  empty?: React.ReactNode
}

/** A short, non-virtualized track list (artist, album and playlist pages). */
export function TrackList({
  songs,
  numberOf,
  extra,
  onFavorite,
  onReorder,
  empty
}: TrackListProps) {
  const { currentSong, setQueue, togglePlay } = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      setQueue: s.setQueue,
      togglePlay: s.togglePlay
    }))
  )
  const menu = useSongMenu()
  const [dragFrom, setDragFrom] = useState<number | null>(null)
  const [over, setOver] = useState<{ index: number; after: boolean } | null>(null)

  if (songs.length === 0) return <>{empty}</>

  const endDrag = () => {
    setDragFrom(null)
    setOver(null)
  }

  const dragHandlers = (i: number): React.HTMLAttributes<HTMLDivElement> => ({
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', songs[i].id)
      setDragFrom(i)
    },
    onDragOver: (e) => {
      if (dragFrom === null) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const r = e.currentTarget.getBoundingClientRect()
      const after = e.clientY > r.top + r.height / 2
      if (over?.index !== i || over.after !== after) setOver({ index: i, after })
    },
    onDrop: (e) => {
      e.preventDefault()
      if (dragFrom !== null && over) {
        // Index in the list once the dragged song has been taken out
        let to = over.index + (over.after ? 1 : 0)
        if (to > dragFrom) to--
        if (to !== dragFrom) onReorder?.(dragFrom, to)
      }
      endDrag()
    },
    onDragEnd: endDrag
  })

  return (
    <div className="card tl">
      <TrackHead />
      {songs.map((song, i) => {
        const active = song.id === currentSong?.id
        const mark =
          dragFrom !== null && over?.index === i && i !== dragFrom
            ? over.after
              ? 'after'
              : 'before'
            : null
        return (
          <TrackRow
            key={song.id}
            song={song}
            number={numberOf ? numberOf(song, i) : i + 1}
            active={active}
            onClick={() => (active ? togglePlay() : setQueue(songs, i))}
            onMenu={(e) => menu.open(e, [song])}
            onFavorite={onFavorite}
            extra={extra?.(song)}
            drag={onReorder ? dragHandlers(i) : undefined}
            dropMark={mark}
            dragging={dragFrom === i}
          />
        )
      })}
      {menu.element}
    </div>
  )
}
