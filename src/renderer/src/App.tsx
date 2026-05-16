import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import './assets/app.css'
import { useLibrary } from './hooks/useLibrary'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import PlayerBar from './components/player/PlayerBar'
import TitleBar from './components/layout/TitleBar'
import SongsPage from './pages/Songs'
import ArtistsPage from './pages/Artists'
import AlbumsPage from './pages/Albums'
import PlaylistsPage from './pages/Playlists'
import DownloadsPage from './pages/Downloads'
import SettingsPage from './pages/Settings'
import { ToastProvider } from './components/ui/Toast'

// Nav icons (inline SVG for zero deps)
const Icons = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  music: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  disc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
}

import logo from './assets/logo.png'

function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar__brand">
        <img src={logo} alt="Logo" className="sidebar__logo" />
        <span className="sidebar__app-name">Music DL</span>
      </div>
      <div className="sidebar__section-label">Library</div>
      <NavLink to="/songs" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.music} Songs
      </NavLink>
      <NavLink to="/artists" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.mic} Artists
      </NavLink>
      <NavLink to="/albums" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.disc} Albums
      </NavLink>
      <NavLink to="/playlists" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.list} Playlists
      </NavLink>
      <div className="sidebar__section-label">Tools</div>
      <NavLink to="/downloads" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.download} Downloads
      </NavLink>
      <NavLink to="/settings" className={({ isActive }) => `sidebar__item${isActive ? ' active' : ''}`}>
        {Icons.settings} Settings
      </NavLink>
    </nav>
  )
}

// Root component: initializes library and audio engine
function AppInner() {
  useLibrary()
  useAudioPlayer()

  return (
    <div className="app-shell">
      <TitleBar />
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Navigate to="/songs" replace />} />
          <Route path="/songs"     element={<SongsPage />} />
          <Route path="/artists"   element={<ArtistsPage />} />
          <Route path="/albums"    element={<AlbumsPage />} />
          <Route path="/playlists" element={<PlaylistsPage />} />
          <Route path="/downloads" element={<DownloadsPage />} />
          <Route path="/settings"  element={<SettingsPage />} />
        </Routes>
      </main>
      <PlayerBar />
      <ToastProvider />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AppInner />
    </HashRouter>
  )
}
