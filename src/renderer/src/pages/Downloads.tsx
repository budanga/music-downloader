import { useRef, useState } from 'react'
import { useDownloadStore } from '../store/downloadStore'
import { useToast } from '../components/ui/Toast'
import type { DownloadItem } from '../../../shared/download.types'
import type { SearchResult } from '../../../shared/types'
import { formatTime } from '../hooks/useAudioPlayer'
import { XIcon } from '../components/ui/icons'
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
  // Search: anything typed that isn't a link
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [searched, setSearched] = useState({ query: '', source: '' })
  const [searching, setSearching] = useState(false)
  /** Search result id → the download it started */
  const [linked, setLinked] = useState<Record<string, string>>({})
  const { queue, clearCompleted } = useDownloadStore()
  const input = useRef<HTMLInputElement>(null)
  const { show } = useToast()

  const items = Array.from(queue.values()).sort((a, b) => b.addedAt - a.addedAt)
  const active = items.filter((i) => !FINISHED.includes(i.status))
  const done = items.filter((i) => FINISHED.includes(i.status))

  // A link downloads as before; anything else is a search
  const looksLikeLink = (s: string) => /^(https?:\/\/|www\.|(m\.|music\.)?youtu)/i.test(s)
  const isLink = looksLikeLink(url.trim())

  const runSearch = async (query: string) => {
    setError('')
    setSearching(true)
    try {
      const [res, source] = await Promise.all([
        window.api.downloads.search(query),
        window.api.settings.get('searchSource')
      ])
      setSearched({ query, source: source === 'ytmusic' ? 'YouTube Music' : 'YouTube' })
      if (res.success) setResults(res.results)
      else {
        setResults(null)
        setError('No se pudo buscar. Revisá tu conexión o que yt-dlp esté instalado.')
      }
    } finally {
      setSearching(false)
    }
  }

  const downloadResult = async (r: SearchResult) => {
    const result = await window.api.downloads.start({ url: r.url, format })
    const id = result.success ? result.ids?.[0] : undefined
    if (!id) return show(result.error || 'No se pudo empezar la descarga', 'error')
    // Put the new item in the list right away (progress events may come a moment later), so
    // "not in the list" always means it was removed
    const fresh = (await window.api.downloads.getQueue()).find((i: DownloadItem) => i.id === id)
    if (fresh)
      useDownloadStore.setState((s) =>
        s.queue.has(id) ? s : { queue: new Map(s.queue).set(id, fresh) }
      )
    setLinked((m) => ({ ...m, [r.id]: id }))
    show(`«${r.title}» en cola`, 'success')
  }

  /** What a result shows: its download's state, or the button when there's none (or it's gone) */
  const resultState = (r: SearchResult): 'button' | 'queued' | 'done' => {
    const item = linked[r.id] ? queue.get(linked[r.id]) : undefined
    if (!item || item.status === 'cancelled' || item.status === 'failed') return 'button'
    return item.status === 'completed' ? 'done' : 'queued'
  }

  const submit = () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError('Pegá un enlace o escribí qué querés buscar.')
      return
    }
    if (looksLikeLink(trimmed)) startDownload(trimmed)
    else runSearch(trimmed)
  }

  const startDownload = async (trimmed: string) => {
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
          <div className="dlfield">
            <input
              ref={input}
              className="field"
              placeholder="Pegá un enlace o buscá una canción, un artista o un disco"
              aria-label="Enlace o búsqueda"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
            {url && (
              <button
                className="ib dlfield__clear"
                title="Borrar"
                aria-label="Borrar lo escrito"
                onClick={() => {
                  setUrl('')
                  setError('')
                  input.current?.focus()
                }}
              >
                <XIcon />
              </button>
            )}
          </div>
          <div className="seg" role="group" aria-label="Formato">
            {(['mp3', 'flac', 'm4a'] as const).map((f) => (
              <button key={f} className={format === f ? 'on' : ''} onClick={() => setFormat(f)}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button className="btn" onClick={submit} disabled={isStarting || searching}>
            {isStarting || searching ? <BrailleSpinner /> : null}
            {isLink || !url.trim() ? 'Descargar' : searching ? 'Buscando…' : 'Buscar'}
          </button>
        </div>
        {error && <div className="err">{error}</div>}
      </div>

      {results && (
        <div className="card results">
          <div className="results__head">
            <span>
              {results.length
                ? `Resultados en ${searched.source} para «${searched.query}»`
                : `No hubo resultados en ${searched.source} para «${searched.query}»`}
            </span>
            <button
              className="ib"
              aria-label="Cerrar los resultados"
              onClick={() => setResults(null)}
            >
              <XIcon />
            </button>
          </div>
          {results.map((r) => (
            <div key={r.id} className="result">
              {r.thumbnail ? (
                <img className="result__thumb" src={r.thumbnail} alt="" loading="lazy" />
              ) : (
                <span className="result__thumb" />
              )}
              <div className="result__t">
                <b title={r.title}>{r.title}</b>
                <span>{[r.artist, r.album].filter(Boolean).join(' · ') || '—'}</span>
              </div>
              <span className="result__d">{r.duration ? formatTime(r.duration) : ''}</span>
              {resultState(r) === 'button' ? (
                <button className="btn ghost sm" onClick={() => downloadResult(r)}>
                  Descargar
                </button>
              ) : resultState(r) === 'done' ? (
                <span className="result__state done">Descargado</span>
              ) : (
                <span className="result__state">En cola</span>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 ? (
        <div className="card empty">
          <DitherCanvas field={ART.downloads} px={3} fine />
          <b>Todavía no descargaste nada</b>
          Pegá un enlace o buscá una canción arriba para empezar.
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
