import { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { FaTimes } from 'react-icons/fa'

export default function ConfirmModal({
  visible,
  open,
  title,
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isVisible = typeof open !== 'undefined' ? open : !!visible

  if (!mounted || !isVisible) return null

  return ReactDOM.createPortal(
    <div style={backdrop} data-confirm-modal>
      <div role="dialog" aria-modal="true" aria-label={title || 'Confirmar acción'} style={card}>
        <button onClick={onCancel} aria-label="Cerrar" style={closeBtn}>
          <FaTimes />
        </button>

        {title && <h2 style={titleStyle}>{title}</h2>}
        <p style={messageStyle}>{message}</p>

        <div style={actions}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={secondaryBtn}
          >
            {cancelText}
          </button>

          <button
            onClick={onConfirm}
            disabled={loading}
            style={confirmBtn(loading)}
          >
            {loading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ===== estilos basados en PublishModal ===== */

const backdrop = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(2,6,23,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  padding: '20px'
}

const card = {
  width: '100%',
  maxWidth: 480,
  background: 'linear-gradient(180deg, #071026 0%, #081426 100%)',
  color: '#EDF2F7',
  borderRadius: 14,
  padding: '22px',
  position: 'relative',
  boxShadow: '0 12px 40px rgba(2,6,23,0.7)',
  fontFamily: '"Rubik", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
  textAlign: 'center'
}

const closeBtn = {
  position: 'absolute',
  right: 14,
  top: 14,
  background: 'transparent',
  border: 'none',
  color: '#9CA3AF',
  fontSize: 18,
  cursor: 'pointer'
}

const titleStyle = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  color: '#fff',
  marginBottom: 12
}

const messageStyle = {
  margin: 0,
  fontSize: 15,
  color: '#E6EEF7',
  marginBottom: 20
}

const actions = {
  display: 'flex',
  gap: 10,
  justifyContent: 'center',
  marginTop: 12,
  width: '100%'
}

const secondaryBtn = {
  padding: '10px 14px',
  borderRadius: 10,
  background: '#E6EEF7',
  color: '#081426',
  fontWeight: 700,
  border: 'none',
  cursor: 'pointer',
  minWidth: 120
}

const confirmBtn = (disabled) => ({
  padding: '10px 14px',
  borderRadius: 10,
  background: disabled
    ? 'linear-gradient(90deg, #94A3B8, #6B7280)'
    : 'linear-gradient(90deg, #06B6D4, #10B981)',
  color: disabled ? '#E6EEF7' : '#021018',
  fontWeight: 800,
  border: 'none',
  cursor: disabled ? 'not-allowed' : 'pointer',
  minWidth: 160
})