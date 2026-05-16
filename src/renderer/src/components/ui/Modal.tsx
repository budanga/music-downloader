import React from 'react'

interface ModalProps {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  danger?: boolean
}

export const Modal: React.FC<ModalProps> = ({
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  danger = false
}) => {
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.6)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center'
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        padding: 24, borderRadius: 12, width: 360, boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: '0 0 24px 0', fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {description}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 16px', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}
          >{cancelText}</button>
          <button
            onClick={onConfirm}
            style={{ 
              padding: '8px 16px', 
              background: danger ? 'var(--red)' : 'var(--accent)', 
              border: 'none', 
              color: 'white', 
              cursor: 'pointer', 
              borderRadius: 6, 
              fontWeight: 600 
            }}
          >{confirmText}</button>
        </div>
      </div>
    </div>
  )
}
