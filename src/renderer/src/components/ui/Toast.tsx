import { createContext, useContext, useState, useCallback } from 'react'
import { AlertIcon, CheckIcon } from './icons'

interface Toast {
  id: string
  message: string
  type: 'info' | 'success' | 'error'
}
interface ToastCtx {
  show: (message: string, type?: Toast['type']) => void
}

const Ctx = createContext<ToastCtx>({ show: () => {} })
// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(Ctx)

export function ToastProvider({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="status">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            {t.type === 'error' ? <AlertIcon /> : <CheckIcon />}
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
