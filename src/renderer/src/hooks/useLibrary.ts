import { useEffect, useCallback } from 'react'
import { useLibraryStore } from '../store/libraryStore'
import { useDownloadStore } from '../store/downloadStore'
import type { Song } from '../../shared/types'

/**
 * useLibrary — loads the library from the main process and subscribes
 * to IPC events to keep the store in sync without full refreshes.
 */
export function useLibrary() {
  const {
    setSongs,
    setArtists,
    setAlbums,
    setPlaylists,
    addSong,
    removeSong,
    updateSong,
    addPlaylist,
    removePlaylist,
    setLoading,
    setLastRefreshed,
  } = useLibraryStore()
  const { updateProgress } = useDownloadStore()

  const refresh = useCallback(async () => {
    if (!window.api) return
    setLoading(true)
    try {
      const [songs, artists, albums, playlists] = await Promise.all([
        window.api.library.getSongs(),
        window.api.library.getArtists(),
        window.api.library.getAlbums(),
        window.api.playlists.list(),
      ])
      setSongs(songs)
      setArtists(artists)
      setAlbums(albums)
      setPlaylists(playlists)
      setLastRefreshed(Date.now())
    } catch (e) {
      console.error('Failed to load library:', e)
    } finally {
      setLoading(false)
    }
  }, [setSongs, setArtists, setAlbums, setPlaylists, setLoading, setLastRefreshed])

  useEffect(() => {
    refresh()

    if (!window.api?.on) return undefined

    // Subscribe to IPC events for real-time updates
    const unsubSongAdded = window.api.on.librarySongAdded((song) => {
      addSong(song as Song)
      // Re-fetch artists and albums because the new song might have created them
      window.api.library.getArtists().then(setArtists)
      window.api.library.getAlbums().then(setAlbums)
    })

    const unsubSongDeleted = window.api.on.librarySongDeleted((id) => {
      removeSong(id)
      window.api.library.getArtists().then(setArtists)
      window.api.library.getAlbums().then(setAlbums)
    })

    const unsubProgress = window.api.on.downloadProgress((progress) => {
      updateProgress(progress)
    })

    const unsubCompleted = window.api.on.downloadCompleted(({ song }) => {
      updateSong(song as Song)
    })

    const unsubPlaylistAdded = window.api.on.libraryPlaylistAdded((playlist) => {
      addPlaylist(playlist as Playlist)
    })

    const unsubPlaylistDeleted = window.api.on.libraryPlaylistDeleted((id) => {
      removePlaylist(id)
    })

    return () => {
      unsubSongAdded()
      unsubSongDeleted()
      unsubProgress()
      unsubCompleted()
      unsubPlaylistAdded()
      unsubPlaylistDeleted()
    }
  }, [refresh, addSong, removeSong, updateSong, updateProgress, addPlaylist, removePlaylist])

  return { refresh }
}
