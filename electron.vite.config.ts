import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const sharedAlias = { '@shared': resolve('src/shared') }

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        ...sharedAlias,
        // Map relative ../../../shared paths from inside src/main/services/...
        '../../../shared': resolve('src/shared'),
        '../../shared': resolve('src/shared'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sharedAlias,
    },
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        ...sharedAlias,
        // renderer imports like '../../shared/types'
        '../../shared': resolve('src/shared'),
      },
    },
    plugins: [react()],
  },
})
