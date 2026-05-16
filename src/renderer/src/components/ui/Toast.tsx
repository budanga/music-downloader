import { createContext, useContext, useState, useCallback } from 'react'

interface Toast { id: string; message: string; type: 'info' | 'success' | 'error' }
interface ToastCtx { show: (message: string, type?: Toast['type']) => void }

const Ctx = createContext<ToastCtx>({ show: () => {} })
export const useToast = () => useContext(Ctx)

export function ToastProvider() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2)
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  return (
    <Ctx.Provider value={{ show }}>
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.type}`}>{t.message}</div>
        ))}
      </div>
    </Ctx.Provider>
  )
}
