import { useState, useEffect } from 'react'
import { useToast } from '../components/ui/Toast'
import SectionCover from '../components/layout/SectionCover'
import { ART } from '../components/motion/art'
import { BrailleSpinner } from '../components/motion/Motion'
import type { AppSettings } from '../../../shared/types'

type YtdlpStatus = { available: boolean; version?: string; error?: string }

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [ytdlp, setYtdlp] = useState<YtdlpStatus | null>(null)
  const [updating, setUpdating] = useState(false)
  const { show } = useToast()

  useEffect(() => {
    window.api.settings.getAll().then(setSettings)
    window.api.system.checkYtdlp().then(setYtdlp)
  }, [])

  const save = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K],
    quiet = false
  ) => {
    await window.api.settings.set(key, value)
    setSettings((s) => (s ? { ...s, [key]: value } : s))
    if (!quiet) show('Ajuste guardado', 'success')
  }

  const chooseDir = async () => {
    const dir = await window.api.system.chooseDirectory()
    if (dir) save('downloadPath', dir)
  }

  const updateYtdlp = async () => {
    setUpdating(true)
    const result = await window.api.system.updateYtdlp()
    setUpdating(false)
    if (result.success) {
      show('yt-dlp actualizado', 'success')
      window.api.system.checkYtdlp().then(setYtdlp)
    } else show(result.error || 'No se pudo actualizar yt-dlp', 'error')
  }

  const art = (
    <SectionCover
      title="Ajustes"
      art={ART.settings}
      pills={
        settings
          ? [
              [ytdlp?.available ? (ytdlp.version ?? '') : '—', 'yt-dlp'],
              [settings.audioFormat.toUpperCase(), 'formato']
            ]
          : []
      }
    />
  )

  if (!settings)
    return (
      <div>
        {art}
        <div className="card loading">
          <BrailleSpinner />
          Cargando ajustes…
        </div>
      </div>
    )

  const toggle = (
    key: 'embedThumbnail' | 'embedMetadata' | 'showNotifications' | 'minimizeToTray',
    label: string
  ) => (
    <button
      className={`sw${settings[key] ? ' on' : ''}`}
      role="switch"
      aria-checked={settings[key]}
      aria-label={label}
      onClick={() => save(key, !settings[key])}
    />
  )
  const seg = <K extends 'audioFormat' | 'audioQuality' | 'theme' | 'searchSource'>(
    key: K,
    options: Array<[AppSettings[K], string]>,
    label: string
  ) => (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([value, text]) => (
        <button
          key={value}
          className={settings[key] === value ? 'on' : ''}
          onClick={() => save(key, value)}
        >
          {text}
        </button>
      ))}
    </div>
  )
  const par = settings.maxConcurrentDownloads

  return (
    <div>
      {art}

      <div className="card sgrp">
        <h3>Apariencia</h3>
        <div className="srow">
          <div>
            <b>Tema</b>
            <small>«Sistema» sigue el modo claro u oscuro de Windows</small>
          </div>
          {seg(
            'theme',
            [
              ['system', 'Sistema'],
              ['light', 'Claro'],
              ['dark', 'Oscuro']
            ],
            'Tema'
          )}
        </div>
      </div>

      <div className="card sgrp">
        <h3>Descargas</h3>
        <div className="srow">
          <div>
            <b>Carpeta</b>
            <small className="mono">{settings.downloadPath}</small>
          </div>
          <button className="btn ghost sm" onClick={chooseDir}>
            Cambiar…
          </button>
        </div>
        <div className="srow">
          <div>
            <b>Buscar en</b>
            <small>Dónde busca el buscador de Descargas</small>
          </div>
          {seg(
            'searchSource',
            [
              ['youtube', 'YouTube'],
              ['ytmusic', 'YouTube Music']
            ],
            'Buscar en'
          )}
        </div>
        <div className="srow">
          <div>
            <b>Formato</b>
            <small>Para todas las descargas</small>
          </div>
          {seg(
            'audioFormat',
            [
              ['mp3', 'MP3'],
              ['flac', 'FLAC'],
              ['m4a', 'M4A']
            ],
            'Formato'
          )}
        </div>
        <div className="srow">
          <div>
            <b>Calidad</b>
          </div>
          {seg(
            'audioQuality',
            [
              ['best', 'Máxima'],
              ['320k', '320'],
              ['256k', '256'],
              ['192k', '192'],
              ['128k', '128']
            ],
            'Calidad'
          )}
        </div>
        <div className="srow">
          <div>
            <b>Descargas simultáneas</b>
            <small>De 1 a 20. «Sin límite» llega hasta 15 a la vez.</small>
          </div>
          <span className="step">
            <button
              className="ib"
              aria-label="Menos"
              disabled={par <= 0}
              onClick={() => save('maxConcurrentDownloads', Math.max(0, par - 1))}
            >
              −
            </button>
            <b>{par === 0 ? 'Sin límite' : par}</b>
            <button
              className="ib"
              aria-label="Más"
              disabled={par >= 20}
              onClick={() => save('maxConcurrentDownloads', Math.min(20, par + 1))}
            >
              +
            </button>
          </span>
        </div>
      </div>

      <div className="card sgrp">
        <h3>Metadatos</h3>
        <div className="srow">
          <div>
            <b>Tapa dentro del archivo</b>
          </div>
          {toggle('embedThumbnail', 'Tapa dentro del archivo')}
        </div>
        <div className="srow">
          <div>
            <b>Etiquetas de título, artista y disco</b>
          </div>
          {toggle('embedMetadata', 'Etiquetas de título, artista y disco')}
        </div>
      </div>

      <div className="card sgrp">
        <h3>Herramientas</h3>
        <div className="srow">
          <div>
            <b>yt-dlp</b>
            {ytdlp === null ? (
              <small>Comprobando…</small>
            ) : ytdlp.available ? (
              <small className="ok">✓ Versión {ytdlp.version}</small>
            ) : (
              <small className="bad-text">No se encontró. Revisá la ruta de abajo.</small>
            )}
          </div>
          <button className="btn ghost sm" onClick={updateYtdlp} disabled={updating}>
            {updating && <BrailleSpinner />}
            {updating ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        <div className="srow">
          <div>
            <b>
              <label htmlFor="ytdlp-path">Ruta de yt-dlp</label>
            </b>
          </div>
          <input
            id="ytdlp-path"
            className="field"
            value={settings.ytdlpPath}
            onChange={(e) => save('ytdlpPath', e.target.value, true)}
            onBlur={() => window.api.system.checkYtdlp().then(setYtdlp)}
          />
        </div>
        <div className="srow">
          <div>
            <b>
              <label htmlFor="ffmpeg-path">Ruta de FFmpeg</label>
            </b>
          </div>
          <input
            id="ffmpeg-path"
            className="field"
            value={settings.ffmpegPath}
            onChange={(e) => save('ffmpegPath', e.target.value, true)}
          />
        </div>
      </div>

      <div className="card sgrp">
        <h3>Aplicación</h3>
        <div className="srow">
          <div>
            <b>Avisos al terminar una descarga</b>
          </div>
          {toggle('showNotifications', 'Avisos al terminar una descarga')}
        </div>
        <div className="srow">
          <div>
            <b>Minimizar a la bandeja</b>
            <small>Al cerrar la ventana, la app sigue en la bandeja del sistema</small>
          </div>
          {toggle('minimizeToTray', 'Minimizar a la bandeja')}
        </div>
      </div>
    </div>
  )
}
