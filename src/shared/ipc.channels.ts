// ─── IPC Channel names shared between main and renderer ─────────────────────

export const IPC = {
  // Library
  LIBRARY_GET_SONGS: 'library:get-songs',
  LIBRARY_GET_ARTISTS: 'library:get-artists',
  LIBRARY_GET_ALBUMS: 'library:get-albums',
  LIBRARY_SEARCH: 'library:search',
  LIBRARY_GET_SONG: 'library:get-song',
  LIBRARY_UPDATE_SONG: 'library:update-song',
  LIBRARY_DELETE_SONG: 'library:delete-song',
  LIBRARY_DELETE_ARTIST: 'library:delete-artist',
  LIBRARY_DELETE_ALBUM: 'library:delete-album',
  LIBRARY_CLEANUP: 'library:cleanup',
  LIBRARY_TOGGLE_FAVORITE: 'library:toggle-favorite',
  LIBRARY_INCREMENT_PLAY_COUNT: 'library:increment-play-count',
  LIBRARY_GET_RECENTLY_PLAYED: 'library:get-recently-played',
  LIBRARY_GET_MOST_PLAYED: 'library:get-most-played',
  LIBRARY_SCAN_FOLDER: 'library:scan-folder',

  // Playlists
  PLAYLIST_LIST: 'playlist:list',
  PLAYLIST_GET: 'playlist:get',
  PLAYLIST_CREATE: 'playlist:create',
  PLAYLIST_UPDATE: 'playlist:update',
  PLAYLIST_DELETE: 'playlist:delete',
  PLAYLIST_ADD_SONG: 'playlist:add-song',
  PLAYLIST_REMOVE_SONG: 'playlist:remove-song',
  PLAYLIST_REORDER: 'playlist:reorder',
  PLAYLIST_GET_SONGS: 'playlist:get-songs',

  // Downloads
  DOWNLOAD_START: 'download:start',
  DOWNLOAD_PAUSE: 'download:pause',
  DOWNLOAD_RESUME: 'download:resume',
  DOWNLOAD_CANCEL: 'download:cancel',
  DOWNLOAD_RETRY: 'download:retry',
  DOWNLOAD_GET_QUEUE: 'download:get-queue',
  DOWNLOAD_CLEAR_COMPLETED: 'download:clear-completed',
  DOWNLOAD_GET_HISTORY: 'download:get-history',

  // Events (main → renderer)
  DOWNLOAD_PROGRESS: 'download:progress',
  DOWNLOAD_COMPLETED: 'download:completed',
  DOWNLOAD_FAILED: 'download:failed',
  LIBRARY_SONG_ADDED: 'library:song-added',
  LIBRARY_SONG_UPDATED: 'library:song-updated',
  LIBRARY_SONG_DELETED: 'library:song-deleted',
  LIBRARY_PLAYLIST_ADDED: 'library:playlist-added',
  LIBRARY_PLAYLIST_DELETED: 'library:playlist-deleted',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // System
  SYSTEM_OPEN_FILE: 'system:open-file',
  SYSTEM_SHOW_IN_FOLDER: 'system:show-in-folder',
  SYSTEM_CHOOSE_DIRECTORY: 'system:choose-directory',
  SYSTEM_CHOOSE_FILE: 'system:choose-file',
  SYSTEM_CHECK_YTDLP: 'system:check-ytdlp',
  SYSTEM_UPDATE_YTDLP: 'system:update-ytdlp',
  SYSTEM_GET_DEFAULT_DOWNLOAD_PATH: 'system:get-default-download-path',
  SYSTEM_MINIMIZE_WINDOW: 'system:minimize-window',
  SYSTEM_MAXIMIZE_WINDOW: 'system:maximize-window',
  SYSTEM_CLOSE_WINDOW: 'system:close-window',
} as const
