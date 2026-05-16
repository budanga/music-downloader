import { create } from 'zustand'
import type { Song, Artist, Album, Playlist } from '../../shared/types'

interface LibraryStore {
  songs: Song[]
  artists: Artist[]
  albums: Album[]
  playlists: Playlist[]
  isLoading: boolean
  lastRefreshed: number

  setSongs: (songs: Song[]) => void
  setArtists: (artists: Artist[]) => void
  setAlbums: (albums: Album[]) => void
  setPlaylists: (playlists: Playlist[]) => void
  addSong: (song: Song) => void
  removeSong: (id: string) => void
  updateSong: (song: Song) => void
  addPlaylist: (playlist: Playlist) => void
  removePlaylist: (id: string) => void
  updatePlaylist: (playlist: Playlist) => void
  setLoading: (v: boolean) => void
  setLastRefreshed: (t: number) => void
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  songs: [],
  artists: [],
  albums: [],
  playlists: [],
  isLoading: false,
  lastRefreshed: 0,

  setSongs: (songs) => set({ songs }),
  setArtists: (artists) => set({ artists }),
  setAlbums: (albums) => set({ albums }),
  setPlaylists: (playlists) => set({ playlists }),

  addSong: (song) => set((s) => ({ songs: [song, ...s.songs] })),
  removeSong: (id) => set((s) => ({ songs: s.songs.filter((s) => s.id !== id) })),
  updateSong: (song) =>
    set((s) => ({ songs: s.songs.map((existing) => (existing.id === song.id ? song : existing)) })),

  addPlaylist: (playlist) => set((s) => ({ playlists: [playlist, ...s.playlists] })),
  removePlaylist: (id) => set((s) => ({ playlists: s.playlists.filter((p) => p.id !== id) })),
  updatePlaylist: (playlist) =>
    set((s) => ({
      playlists: s.playlists.map((p) => (p.id === playlist.id ? playlist : p)),
    })),

  setLoading: (v) => set({ isLoading: v }),
  setLastRefreshed: (t) => set({ lastRefreshed: t }),
}))
