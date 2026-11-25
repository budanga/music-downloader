import type { Song } from '../../../../shared/types'
import { useLibraryStore } from '../../store/libraryStore'
import { usePlayerStore } from '../../store/playerStore'

/**
 * Deletes songs from the library and from disk, then drops the artists and albums left empty
 * and refreshes the lists.
 */
export async function deleteSongs(list: Song[]): Promise<void> {
  for (const song of list) {
    usePlayerStore.getState().removeBySongId(song.id)
    await new Promise((r) => setTimeout(r, 50)) // let the audio element release the file
    try {
      await window.api.library.deleteSong(song.id, true)
    } catch (e) {
      console.error('Failed to delete file', e)
    }
    useLibraryStore.getState().removeSong(song.id)
  }
  await window.api.library.cleanup()
  const lib = useLibraryStore.getState()
  window.api.library.getArtists().then(lib.setArtists)
  window.api.library.getAlbums().then(lib.setAlbums)
  window.api.playlists.list().then(lib.setPlaylists)
}
