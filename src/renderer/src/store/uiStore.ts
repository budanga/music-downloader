import { create } from 'zustand'

/** Search text typed in the sidebar (the Songs page filters by it) and the queue panel. */
interface UiStore {
  query: string
  setQuery: (q: string) => void
  queueOpen: boolean
  setQueueOpen: (open: boolean) => void
}

export const useUiStore = create<UiStore>((set) => ({
  query: '',
  setQuery: (query) => set({ query }),
  queueOpen: false,
  setQueueOpen: (queueOpen) => set({ queueOpen })
}))
