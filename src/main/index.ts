import { app, BrowserWindow, Tray, Menu, nativeImage, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase } from './services/database/Database'
import { registerAllIpcHandlers } from './ipc/handlers'
import { cleanupLibrary } from './services/database/SongRepository'
import { downloadManager } from './services/downloader/DownloadManager'
import { closeDatabase } from './services/database/Database'
import fs from 'fs'
import { getAllSettings } from './services/database/SettingsRepository'

// Must be called before app.whenReady()
protocol.registerSchemesAsPrivileged([
  { scheme: 'music', privileges: { secure: true, supportFetchAPI: true, stream: true, standard: true } }
])

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// ─── Custom Protocol for Local Audio Files ────────────────────────────────────

function registerMusicProtocol(): void {
  // Use registerFileProtocol which natively handles Range requests for media streaming in C++.
  // net.fetch() with file:// URLs does not properly respond with 206 Partial Content.
  protocol.registerFileProtocol('music', (request, callback) => {
    try {
      const url = new URL(request.url)
      
      // We expect music://library/C:/path/to/file.mp3
      if (url.host !== 'library') {
        callback({ error: -2 }) // FAILED
        return
      }

      let filePath = decodeURIComponent(url.pathname)
      
      // On Windows, the pathname starts with /C:/..., so we remove the leading slash
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1)
      }

      callback({ path: filePath })
    } catch (e) {
      console.error('[Protocol] Error handling music request:', e)
      callback({ error: -6 }) // FILE_NOT_FOUND
    }
  })
}

// ─── Window Creation ──────────────────────────────────────────────────────────

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false,           // Custom title bar
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f13',
    icon: join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show window gracefully after ready
  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  // Minimize to tray if enabled
  mainWindow.on('close', (e) => {
    const settings = getAllSettings()
    if (settings.minimizeToTray && tray) {
      e.preventDefault()
      mainWindow!.hide()
    }
  })

  // Connect download manager to window for IPC push events
  downloadManager.setMainWindow(mainWindow)

  // Open DevTools in dev
  if (is.dev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }

  // Load the app
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── System Tray ─────────────────────────────────────────────────────────────

function createTray(): void {
  const iconPath = join(__dirname, '../../resources/tray-icon.png')
  const icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty()

  tray = new Tray(icon)
  tray.setToolTip('Music Downloader')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show App', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit() } },
  ])

  tray.setContextMenu(contextMenu)
  tray.on('double-click', () => mainWindow?.show())
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.musicdownloader.app')

  // Initialize database
  try {
    const dbPath = require('path').join(app.getPath('userData'), 'music-library.db')
    initDatabase(dbPath)
  } catch (e) {
    console.error('Failed to initialize database:', e)
  }

  // Register all IPC handlers
  registerAllIpcHandlers()

  // Auto-cleanup library (remove artists/albums with 0 songs)
  try {
    cleanupLibrary()
  } catch (e) {
    console.error('Failed to cleanup library:', e)
  }

  // Register music protocol
  registerMusicProtocol()

  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    closeDatabase()
    app.quit()
  }
})

app.on('before-quit', () => {
  closeDatabase()
})

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
