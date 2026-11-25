import { useState } from 'react'
import { useDownloadStore } from '../store/downloadStore'
import { useToast } from '../components/ui/Toast'
import type { DownloadItem } from '../../../shared/download.types'
import { isValidYoutubeUrl } from '../../../shared/url'
import SectionCover from '../components/layout/SectionCover'
import { ART, coverFn } from '../components/motion/art'
import type { Tone } from '../components/motion/kit'
import { BrailleSpinner, DecryptText, DitherBar, DitherCanvas } from '../components/motion/Motion'

type Status = DownloadItem['status']

const LABEL: Record<Status, string> = {
  queued: 'En cola',
  fetching_info: 'Buscando datos de la canción',
  downloading: 'Descargando',
  converting: 'Convirtiendo',
  embedding_metadata: 'Guardando etiquetas y tapa',
  completed: 'En el archivo',
  failed: 'No se pudo descargar',
  cancelled: 'Cancelada',
  paused: 'En pausa'
}
const WORKING: Status[] = ['fetching_info', 'downloading', 'converting', 'embedding_metadata']
const FINISHED: Status[] = ['completed', 'failed', 'cancelled']

const barColor = (s: Status): Tone =>
  s === 'failed' || s === 'cancelled'
    ? 'danger'
    : s === 'completed'
      ? 'success'
      : s === 'paused'
        ? 'warning'
        : 'accent'

/** The main process uses placeholder titles until yt-dlp answers. */
const hasRealTitle = (item: DownloadItem) =>
  !!item.title && !/^Fetching|^Playlist \(/.test(item.title)

function JobCard({ item }: { item: DownloadItem }) {
  const { show } = useToast()
  const real = hasRealTitle(item)
  const title = real ? item.title : item.url.replace(/^https?:\/\/(www\.)?/, '')
  const remove = async () => {
    if (!FINISHED.includes(item.status) && item.status !== 'paused')
      await window.api.downloads.cancel(item.id)
    useDownloadStore.getState().removeItem(item.id)
  }

  return (
    <div className="card job">
      <div className="job__th">
        <DitherCanvas field={real ? coverFn(item.title) : ART.downloads} px={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <DecryptText className="t" text={title} ms={700} />
        <div className="by">
          {item.uploader || (real ? 'Artista desconocido' : 'Esperando los datos…')}
        </div>
        <div className="s">
          <span>
            {WORKING.includes(item.status) && <BrailleSpinner />} {LABEL[item.status]}
            {item.status === 'downloading' && item.speed ? ` · ${item.speed}` : ''}
            {item.status === 'downloading' && item.eta ? ` · faltan ${item.eta}` : ''}
          </span>
          <span className="mono">{Math.round(item.progress)}%</span>
        </div>
        <DitherBar className="pb" value={item.progress / 100} color={barColor(item.status)} />
        {item.error && <div className="bad">{item.error}</div>}
      </div>
      <div className="ja">
        {item.status === 'failed' && (
          <button
            className="btn ghost sm"
            onClick={async () => {
              await window.api.downloads.retry(item.id)
              show('Reintentando…', 'info')
            }}
          >
            Reintentar
          </button>
        )}
        {(item.status === 'queued' ||
          item.status === 'downloading' ||
          item.status === 'fetching_info') && (
          <>
            <button className="btn ghost sm" onClick={() => window.api.downloads.pause(item.id)}>
              Pausar
            </button>
            <button className="btn ghost sm" onClick={() => window.api.downloads.cancel(item.id)}>
              Cancelar
            </button>
          </>
        )}
        {item.status === 'paused' && (
          <>
            <button className="btn ghost sm" onClick={() => window.api.downloads.resume(item.id)}>
              Seguir
            </button>
            <button className="btn ghost sm" onClick={() => window.api.downloads.cancel(item.id)}>
              Cancelar
            </button>
          </>
        )}
        {FINISHED.includes(item.status) && (
          <button className="btn ghost sm" onClick={remove}>
            Quitar
          </button>
        )}
      </div>
    </div>
  )
}

export default function DownloadsPage() {
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'mp3' | 'flac' | 'm4a'>('mp3')
  const [isStarting, setIsStarting] = useState(false)
  const [error, setError] = useState('')
  const { queue, clearCompleted } = useDownloadStore()
  const { show } = useToast()

  const items = Array.from(queue.values()).sort((a, b) => b.addedAt - a.addedAt)
  const active = items.filter((i) => !FINISHED.includes(i.status))
  const done = items.filter((i) => FINISHED.includes(i.status))

  const startDownload = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Pegá un enlace primero.')
      return
    }
    if (!isValidYoutubeUrl(trimmed)) {
      setError('Ese enlace no es de YouTube ni de YouTube Music.')
      return
    }
    setError('')
    setIsStarting(true)
    try {
      const result = await window.api.downloads.start({ url: trimmed, format })
      if (result.success) {
        setUrl('')
        show('Descarga en cola', 'success')
      } else setError(result.error || 'No se pudo empezar la descarga.')
    } finally {
      setIsStarting(false)
    }
  }

  return (
    <div>
      <SectionCover
        title="Descargas"
        art={ART.downloads}
        pills={[
          [active.length, 'en curso'],
          [items.length, 'en total']
        ]}
      />

      <div className="card dlin">
        <div className="dlrow">
          <input
            className="field"
            placeholder="https://music.youtube.com/watch?v=…"
            aria-label="Enlace de YouTube o YouTube Music"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && startDownload()}
          />
          <div className="seg" role="group" aria-label="Formato">
            {(['mp3', 'flac', 'm4a'] as const).map((f) => (
              <button key={f} className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn" onClick={startDownload} disabled={isStarting}>
            {isStarting ? <BrailleSpinner /> : null}
            Descargar
          </button>
        </div>
        {error && <div className="err">{error}</div>}
      </div>

      {items.length === 0 ? (
        <div className="card empty">
          <DitherCanvas field={ART.downloads} px={3} fine />
          <b>Todavía no descargaste nada</b>
          Pegá un enlace arriba para empezar.
        </div>
      ) : (
        <div className="jobs">
          {active.length > 0 && (
            <div className="jobs__head">
              <span>En curso</span>
              <span className="bar__actions">
                <button className="btn ghost sm" onClick={() => window.api.downloads.pause()}>
                  Pausar todo
                </button>
                {items.some((i) => i.status === 'paused') && (
                  <button className="btn ghost sm" onClick={() => window.api.downloads.resume()}>
                    Reanudar todo
                  </button>
                )}
              </span>
            </div>
          )}
          {active.map((item) => (
            <JobCard key={item.id} item={item} />
          ))}
          {done.length > 0 && (
            <div className="jobs__head">
              <span>Historial</span>
              <button
                className="btn ghost sm"
                onClick={async () => {
                  await window.api.downloads.clearCompleted()
                  clearCompleted()
                }}
              >
                Limpiar terminadas
              </button>
            </div>
          )}
          {done.map((item) => (
            <JobCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  )
}
