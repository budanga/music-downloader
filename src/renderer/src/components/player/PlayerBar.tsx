import { usePlayerStore } from '../../store/playerStore'
import { formatTime } from '../../hooks/useAudioPlayer'
import { useCallback, useState } from 'react'
import HeartButton from '../ui/HeartButton'

// Inline SVGs
const PlayIcon  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const PauseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
const PrevIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" strokeWidth="2"/></svg>
const NextIcon  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2"/></svg>
const ShuffleIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
const RepeatIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
const VolumeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>

export default function PlayerBar() {
  const {
    currentSong, isPlaying, isShuffle, repeatMode, volume, isMuted,
    currentTime, duration, togglePlay, next, previous, toggleShuffle,
    cycleRepeat, setVolume, toggleMute, seekTo,
  } = usePlayerStore()

  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)

  // When dragging starts or continues
  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setIsDragging(true)
    setDragTime(parseFloat(e.target.value))
  }, [])

  // When user releases the slider
  const handleSeekCommit = useCallback((e: React.PointerEvent<HTMLInputElement>) => {
    seekTo(parseFloat(e.currentTarget.value))
    setIsDragging(false)
  }, [seekTo])

  const displayTime = isDragging ? dragTime : currentTime
  const seekPct = duration > 0 ? (displayTime / duration) * 100 : 0

  return (
    <div className="player-bar">
      {/* Left: current song info */}
      <div className="player-bar__song">
        {currentSong?.thumbnail
          ? <img src={currentSong.thumbnail} alt="" className="player-bar__art" />
          : <div className="player-bar__art-placeholder">♫</div>
        }
        <div className="player-bar__info">
          <div className="player-bar__title">{currentSong?.title ?? 'Nothing playing'}</div>
          <div className="player-bar__artist">{currentSong?.artistName ?? ''}</div>
        </div>
        {currentSong && (
          <HeartButton
            isFavorite={!!currentSong.isFavorite}
            onClick={() => window.api.library.toggleFavorite(currentSong.id)}
            size={20}
          />
        )}
      </div>

      {/* Center: controls */}
      <div className="player-controls">
        <div className="player-controls__buttons">
          <button className={`ctrl-btn${isShuffle ? ' active' : ''}`} onClick={toggleShuffle} title="Shuffle">
            <ShuffleIcon />
          </button>
          <button className="ctrl-btn" onClick={previous} title="Previous">
            <PrevIcon />
          </button>
          <button className="ctrl-btn ctrl-btn--play" onClick={togglePlay} title="Play/Pause">
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button className="ctrl-btn" onClick={next} title="Next">
            <NextIcon />
          </button>
          <button className={`ctrl-btn${repeatMode !== 'none' ? ' active' : ''}`} onClick={cycleRepeat} title="Repeat">
            <RepeatIcon />
            {repeatMode === 'one' && <span style={{ fontSize: 9, position: 'absolute', marginTop: 14 }}>1</span>}
          </button>
        </div>

        <div className="seek-row">
          <span className="seek-row__time">{formatTime(displayTime)}</span>
          <input
            type="range"
            className="range-slider seek"
            min={0}
            max={duration || 1}
            step={0.5}
            value={displayTime}
            onChange={handleSeekChange}
            onPointerUp={handleSeekCommit}
            style={{ '--val': `${seekPct}%` } as React.CSSProperties}
          />
          <span className="seek-row__time">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: volume */}
      <div className="player-bar__right">
        <button className="ctrl-btn" onClick={toggleMute} title="Mute">
          <VolumeIcon />
        </button>
        <div className="volume-row">
          <input
            type="range"
            className="range-slider"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            style={{ '--val': `${(isMuted ? 0 : volume) * 100}%` } as React.CSSProperties}
          />
        </div>
      </div>
    </div>
  )
}
