import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { scrollMainToTop } from './components/layout/scroll'
import './assets/app.css'
import { useLibrary } from './hooks/useLibrary'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import PlayerBar from './components/player/PlayerBar'
import QueuePanel from './components/player/QueuePanel'
import TitleBar from './components/layout/TitleBar'
import Sidebar from './components/layout/Sidebar'
import SongsPage from './pages/Songs'
import ArtistsPage from './pages/Artists'
import AlbumsPage from './pages/Albums'
import PlaylistsPage from './pages/Playlists'
import DownloadsPage from './pages/Downloads'
import SettingsPage from './pages/Settings'
import { ToastProvider } from './components/ui/Toast'

// Root component: initializes library and audio engine
function AppInner() {
  useLibrary()
  useAudioPlayer()
  const { pathname } = useLocation()
  useEffect(() => scrollMainToTop(), [pathname])

  return (
    <div className="shell">
      <TitleBar />
      <div className="body">
        <Sidebar />
        <main className="main" id="main-scroll">
          <Routes>
            <Route path="/" element={<Navigate to="/songs" replace />} />
            <Route path="/songs" element={<SongsPage />} />
            <Route path="/artists" element={<ArtistsPage />} />
            <Route path="/artists/:id" element={<ArtistsPage />} />
            <Route path="/albums" element={<AlbumsPage />} />
            <Route path="/albums/:id" element={<AlbumsPage />} />
            <Route path="/playlists" element={<PlaylistsPage />} />
            <Route path="/playlists/:id" element={<PlaylistsPage />} />
            <Route path="/downloads" element={<DownloadsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <QueuePanel />
      </div>
      <PlayerBar />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </HashRouter>
  )
}
