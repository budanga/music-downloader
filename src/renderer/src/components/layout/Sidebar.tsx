import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useLibraryStore } from '../../store/libraryStore'
import { useDownloadStore } from '../../store/downloadStore'
import { useUiStore } from '../../store/uiStore'
import { logoFn } from '../motion/art'
import { BrailleSpinner, DitherBar, DitherCanvas } from '../motion/Motion'
import { SearchIcon } from '../ui/icons'

const RUNNING = ['queued', 'fetching_info', 'downloading', 'converting', 'embedding_metadata']

export default function Sidebar() {
  const songs = useLibraryStore((s) => s.songs.length)
  const artists = useLibraryStore((s) => s.artists.length)
  const albums = useLibraryStore((s) => s.albums.length)
  const playlists = useLibraryStore((s) => s.playlists.length)
  const queue = useDownloadStore((s) => s.queue)
  const { query, setQuery } = useUiStore()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const running = Array.from(queue.values()).filter((d) => RUNNING.includes(d.status))
  const avg = running.length
    ? running.reduce((t, d) => t + d.progress, 0) / running.length / 100
    : 0

  const items: Array<[string, string, string, number | string]> = [
    ['/songs', 'I', 'Canciones', songs],
    ['/artists', 'II', 'Artistas', artists],
    ['/albums', 'III', 'Discos', albums],
    ['/playlists', 'IV', 'Listas', playlists],
    ['/downloads', 'V', 'Descargas', running.length || ''],
    ['/settings', 'VI', 'Ajustes', '']
  ]

  return (
    <aside className="side" aria-label="Índice">
      <div className="brand">
        <DitherCanvas field={logoFn} px={1.5} />
      </div>
      <label className="search">
        <SearchIcon />
        <input
          placeholder="Buscar canción, artista o disco"
          aria-label="Buscar"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (pathname !== '/songs') navigate('/songs')
          }}
        />
      </label>
      <nav className="nav" aria-label="Secciones">
        <div className="navlbl">Archivo</div>
        {items.map(([to, n, label, count]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `ni${isActive ? ' active' : ''}`}>
            <i>{n}</i>
            {label}
            <small>{count}</small>
          </NavLink>
        ))}
      </nav>
      {running.length > 0 && (
        <div className="mini">
          <div className="h">
            <BrailleSpinner />
            {running.length} {running.length === 1 ? 'descarga' : 'descargas'} en curso
          </div>
          <DitherBar value={avg} />
          <NavLink to="/downloads">Ver descargas →</NavLink>
        </div>
      )}
    </aside>
  )
}
