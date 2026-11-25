import { useState, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { usePlayerStore } from '../../store/playerStore'
import { useUiStore } from '../../store/uiStore'
import { formatTime } from '../../hooks/useAudioPlayer'
import { ART, coverFn } from '../motion/art'
import { AsciiSpectrum, DecryptText, DitherBar, DitherCanvas } from '../motion/Motion'
import HeartButton from '../ui/HeartButton'
import {
  ListIcon,
  MuteIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  ShuffleIcon,
  VolumeIcon
} from '../ui/icons'

export default function PlayerBar() {
  const p = usePlayerStore(
    useShallow((s) => ({
      currentSong: s.currentSong,
      isPlaying: s.isPlaying,
      isShuffle: s.isShuffle,
      repeatMode: s.repeatMode,
      volume: s.volume,
      isMuted: s.isMuted,
      currentTime: s.currentTime,
      duration: s.duration,
      togglePlay: s.togglePlay,
      next: s.next,
      previous: s.previous,
      toggleShuffle: s.toggleShuffle,
      cycleRepeat: s.cycleRepeat,
      setVolume: s.setVolume,
      toggleMute: s.toggleMute,
      seekTo: s.seekTo
    }))
  )
  const { queueOpen, setQueueOpen } = useUiStore()
  const [drag, setDrag] = useState<number | null>(null)
  const vol = p.isMuted ? 0 : p.volume
  const song = p.currentSong
  const duration = p.duration || song?.duration || 0
  const repeatTitle = {
    none: 'Repetir',
    all: 'Repitiendo la cola',
    one: 'Repitiendo esta canción'
  }[p.repeatMode]

  return (
    <footer className="player" aria-label="Reproductor">
      <div className="player__cover">
        <DitherCanvas field={song ? coverFn(song.albumTitle || song.title) : ART.albums} px={2} />
      </div>

      <div className="pinfo">
        <div className="row1">
          <DecryptText className="t" text={song?.title ?? 'Nada sonando'} />
          {song && (
            <HeartButton
              isFavorite={song.isFavorite}
              onClick={() => window.api.library.toggleFavorite(song.id)}
            />
          )}
        </div>
        <div className="a">
          {song
            ? [song.artistName, song.albumTitle].filter(Boolean).join(' · ')
            : 'Elegí una canción del archivo'}
        </div>
        <div className="prog">
          <span>{formatTime(drag !== null ? drag * duration : p.currentTime)}</span>
          <DitherBar
            value={drag ?? (duration ? p.currentTime / duration : 0)}
            onSeek={(v) => song && setDrag(v)}
            onCommit={(v) => {
              if (song) p.seekTo(v * duration)
              setDrag(null)
            }}
            label="Posición de la canción"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      <div className="ctl">
        <button
          className={`ib${p.isShuffle ? ' on' : ''}`}
          onClick={p.toggleShuffle}
          title="Aleatorio"
          aria-label="Aleatorio"
          aria-pressed={p.isShuffle}
        >
          <ShuffleIcon />
        </button>
        <button className="ib" onClick={p.previous} title="Anterior" aria-label="Anterior">
          <PrevIcon />
        </button>
        <button
          className="play"
          onClick={p.togglePlay}
          aria-label={p.isPlaying ? 'Pausar' : 'Reproducir'}
        >
          {p.isPlaying ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button className="ib" onClick={() => p.next()} title="Siguiente" aria-label="Siguiente">
          <NextIcon />
        </button>
        <button
          className={`ib${p.repeatMode !== 'none' ? ' on' : ''}`}
          onClick={p.cycleRepeat}
          title={repeatTitle}
          aria-label={repeatTitle}
        >
          <RepeatIcon />
          {p.repeatMode === 'one' && <span className="badge">1</span>}
        </button>
      </div>

      <AsciiSpectrum className={`spec${p.isPlaying ? '' : ' idle'}`} />

      <div className="vol">
        <button
          className={`ib${queueOpen ? ' on' : ''}`}
          onClick={() => setQueueOpen(!queueOpen)}
          title="Cola de reproducción"
          aria-label="Cola de reproducción"
          aria-pressed={queueOpen}
        >
          <ListIcon />
        </button>
        <button
          className="ib"
          onClick={p.toggleMute}
          title={p.isMuted ? 'Activar sonido' : 'Silenciar'}
          aria-label={p.isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {p.isMuted || p.volume === 0 ? <MuteIcon /> : <VolumeIcon />}
        </button>
        <input
          type="range"
          className="range"
          min={0}
          max={1}
          step={0.01}
          value={vol}
          onChange={(e) => p.setVolume(Number(e.target.value))}
          style={{ '--v': `${vol * 100}%` } as CSSProperties}
          aria-label="Volumen"
        />
      </div>
    </footer>
  )
}
