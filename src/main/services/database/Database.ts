/**
 * Database layer using Node.js built-in `node:sqlite`
 * (available in Node.js 22.5+ / Electron 33+).
 * 
 * No native compilation needed — works out of the box with Electron 39.
 */

// node:sqlite uses a different import style in Electron's Node context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NodeSqliteDB = any

let db: NodeSqliteDB = null

export function initDatabase(dbPath: string): NodeSqliteDB {
  // Use dynamic require so bundler doesn't try to resolve it at build time
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync } = require('node:sqlite')

  db = new DatabaseSync(dbPath)

  // Enable WAL mode & foreign keys via pragma
  db.exec(`PRAGMA journal_mode = WAL`)
  db.exec(`PRAGMA foreign_keys = ON`)
  db.exec(`PRAGMA synchronous = NORMAL`)
  db.exec(`PRAGMA cache_size = -32000`)

  runMigrations()
  return db
}

export function getDatabase(): NodeSqliteDB {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function closeDatabase(): void {
  if (db) {
    try { db.close() } catch { /* ignore */ }
    db = null
  }
}

/**
 * Transaction helper for node:sqlite DatabaseSync
 */
export function runInTransaction<T>(fn: () => T): T {
  const d = getDatabase()
  d.exec('BEGIN')
  try {
    const result = fn()
    d.exec('COMMIT')
    return result
  } catch (e) {
    d.exec('ROLLBACK')
    throw e
  }
}

// ─── Migrations ────────────────────────────────────────────────────────────────

function runMigrations(): void {
  const d = db
  d.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`)

  const row = d.prepare(`SELECT version FROM schema_version LIMIT 1`).get()
  const currentVersion = (row as { version: number } | undefined)?.version ?? 0

  const migrations = [
    migration001_schema,
    migration002_indexes,
    migration003_playlist_ytid,
    migration004_downloads_persistence,
    migration005_fts,
    migration006_liked_songs,
  ]

  for (let v = currentVersion; v < migrations.length; v++) {
    migrations[v](d)
    if (v === 0) {
      d.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(migrations.length)
    } else {
      d.prepare(`UPDATE schema_version SET version = ?`).run(v + 1)
    }
  }
}

function migration004_downloads_persistence(d: NodeSqliteDB): void {
  // Add missing columns to download_history to support full state persistence
  try { d.exec(`ALTER TABLE download_history ADD COLUMN thumbnail TEXT;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN uploader TEXT;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN playlist_id TEXT;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN is_playlist INTEGER DEFAULT 0;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN playlist_total INTEGER DEFAULT 0;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN playlist_done INTEGER DEFAULT 0;`) } catch {}
  try { d.exec(`ALTER TABLE download_history ADD COLUMN track_number INTEGER;`) } catch {}
}

function migration001_schema(d: NodeSqliteDB): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS artists (
      id    TEXT PRIMARY KEY,
      name  TEXT UNIQUE NOT NULL,
      image TEXT
    );

    CREATE TABLE IF NOT EXISTS albums (
      id        TEXT PRIMARY KEY,
      title     TEXT NOT NULL,
      artist_id TEXT REFERENCES artists(id),
      year      INTEGER,
      thumbnail TEXT,
      UNIQUE(title, artist_id)
    );

    CREATE TABLE IF NOT EXISTS songs (
      id           TEXT PRIMARY KEY,
      yt_id        TEXT UNIQUE,
      title        TEXT NOT NULL,
      artist_id    TEXT REFERENCES artists(id),
      album_id     TEXT REFERENCES albums(id),
      duration     INTEGER DEFAULT 0,
      file_path    TEXT NOT NULL,
      thumbnail    TEXT,
      track_number INTEGER,
      genre        TEXT,
      year         INTEGER,
      bitrate      INTEGER,
      format       TEXT DEFAULT 'mp3',
      file_size    INTEGER,
      play_count   INTEGER DEFAULT 0,
      is_favorite  INTEGER DEFAULT 0,
      date_added   INTEGER NOT NULL,
      last_played  INTEGER
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      description   TEXT,
      thumbnail     TEXT,
      yt_id         TEXT,
      date_created  INTEGER NOT NULL,
      date_modified INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlist_id TEXT REFERENCES playlists(id) ON DELETE CASCADE,
      song_id     TEXT REFERENCES songs(id) ON DELETE CASCADE,
      position    INTEGER NOT NULL,
      date_added  INTEGER NOT NULL,
      PRIMARY KEY (playlist_id, song_id)
    );

    CREATE TABLE IF NOT EXISTS download_history (
      id        TEXT PRIMARY KEY,
      yt_id     TEXT,
      url       TEXT NOT NULL,
      title     TEXT,
      status    TEXT NOT NULL,
      error     TEXT,
      song_id   TEXT REFERENCES songs(id),
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `)
}

function migration002_indexes(d: NodeSqliteDB): void {
  d.exec(`
    CREATE INDEX IF NOT EXISTS idx_songs_artist   ON songs(artist_id);
    CREATE INDEX IF NOT EXISTS idx_songs_album    ON songs(album_id);
    CREATE INDEX IF NOT EXISTS idx_songs_title    ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_date     ON songs(date_added DESC);
    CREATE INDEX IF NOT EXISTS idx_songs_fav      ON songs(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_playlist_order ON playlist_songs(playlist_id, position);
    CREATE INDEX IF NOT EXISTS idx_albums_artist  ON albums(artist_id);
    CREATE INDEX IF NOT EXISTS idx_history_time   ON download_history(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_playlists_ytid ON playlists(yt_id);
  `)
}

function migration003_playlist_ytid(d: NodeSqliteDB): void {
  try {
    d.exec(`ALTER TABLE playlists ADD COLUMN yt_id TEXT;`)
  } catch (e) {
    // Column might already exist
  }
}

function migration005_fts(d: NodeSqliteDB): void {
  try {
    // Create FTS5 table for fast searching
    d.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS songs_fts USING fts5(
        title,
        artist_name,
        album_title,
        genre,
        content='songs'
      );
    `)

    // Populate FTS table
    d.exec(`
      INSERT INTO songs_fts(rowid, title, artist_name, album_title, genre)
      SELECT s.id, s.title, ar.name, al.title, s.genre
      FROM songs s
      LEFT JOIN artists ar ON ar.id = s.artist_id
      LEFT JOIN albums al ON al.id = s.album_id
      WHERE NOT EXISTS (SELECT 1 FROM songs_fts WHERE rowid = s.id);
    `)
  } catch (e) {
    console.error('FTS5 migration failed (might not be supported by this build):', e)
  }
}

function migration006_liked_songs(d: NodeSqliteDB): void {
  const now = Date.now()
  d.prepare(
    `INSERT OR IGNORE INTO playlists (id, name, description, thumbnail, yt_id, date_created, date_modified)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run('liked-songs', 'Liked Songs', 'Your favorite songs', null, null, now, now)
}

