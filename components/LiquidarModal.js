'use client'

import React, { useEffect, useState } from 'react'

export default function LiquidarModalSupplier({ open, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [balance, setBalance] = useState(null)
  const [amount, setAmount] = useState('') // string para input
  const [error, setError] = useState(null)
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    if (!open) return
    setError(null)
    setAmount('')
    setBalance(null)
    fetchInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function fetchInfo() {
    setChecking(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch(`${BASE_URL}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Error al obtener usuario ${res.status}`)
      const json = await res.json()
      setBalance(json.balance ?? json.walletBalance ?? json.available ?? 0)
    } catch (err) {
      console.error('LiquidarModalSupplier fetch error:', err)
      setError(err.message || String(err))
    } finally {
      setChecking(false)
    }
  }

  const parseAmount = () => {
    if (amount === '' || amount == null) return null
    const n = Number(amount)
    if (Number.isNaN(n)) return null
    return Number(n.toFixed(2))
  }

  const insufficient = (() => {
    const a = parseAmount()
    if (a == null || balance == null) return false
    return Number(balance) < Number(a)
  })()

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('accessToken')
      const a = parseAmount()
      if (a == null || a <= 0) {
        setError('Ingresa un monto válido mayor que 0')
        setLoading(false)
        return
      }
      if (balance == null) {
        setError('No se pudo obtener saldo disponible')
        setLoading(false)
        return
      }
      if (Number(balance) < Number(a)) {
        setError('Saldo insuficiente para este retiro')
        setLoading(false)
        return
      }

      // Llamada al endpoint específico para proveedores
      const res = await fetch(`${BASE_URL}/api/wallet/provider/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: a, isSoles: false }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        let msg = `Error ${res.status}`
        try {
          const errJson = JSON.parse(txt || '{}')
          msg = errJson?.message || errJson?.error || txt || msg
        } catch {
          msg = txt || msg
        }
        throw new Error(msg)
      }

      const created = await res.json()
      if (onDone) onDone(created)
      onClose()
    } catch (err) {
      console.error('Error request withdrawal:', err)
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const formatMoney = (v) => {
    if (v == null) return '—'
    const n = typeof v === 'number' ? v : Number(v)
    if (Number.isNaN(n)) return String(v)
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }

  return (
    <div style={backdrop}>
      <div role="dialog" aria-modal="true" style={card}>
        <button onClick={onClose} aria-label="Cerrar" style={closeBtn}>✕</button>

        {checking ? (
          <div style={centerSection}>
            <p style={muted}>Cargando información…</p>
          </div>
        ) : error ? (
          <div style={centerSection}>
            <p style={errorText}>Error: {error}</p>
            <div style={{ marginTop: 12 }}>
              <button onClick={fetchInfo} style={outlineBtn}>Reintentar</button>
            </div>
          </div>
        ) : (
          <div style={content}>
            <div style={header}>
              <h2 style={title}>Liquidar saldo</h2>
              <p style={subtitle}>Solicita un retiro en dólares</p>
            </div>

            <div style={bigValuesRow}>
              <div style={bigValueCard}>
                <div style={bigLabel}>Saldo disponible (USD)</div>
                <div style={bigValue}>{formatMoney(balance)}</div>
              </div>

              <div style={bigValueCard}>
                <div style={bigLabel}>Monto a retirar</div>
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Monto en USD"
                  style={amountInput}
                />
                <div style={{ fontSize: 12, color: '#9FB4C8', marginTop: 6 }}>Ingresa el monto en dólares</div>
              </div>
            </div>

            {insufficient && (
              <div style={insufficientBanner}>Saldo insuficiente para este retiro</div>
            )}

            <div style={infoBox}>
              <div style={{ fontSize: 13, color: '#9FB4C8', textAlign: 'center' }}>
                Se generará una solicitud de retiro en estado pendiente. No se descontará el saldo hasta su aprobación.
              </div>
            </div>

            <div style={actions}>
              <button onClick={onClose} style={secondaryBtn} disabled={loading}>Cerrar</button>
              <button
                onClick={handleConfirm}
                style={confirmBtn(insufficient || loading)}
                disabled={loading || insufficient}
              >
                {loading ? 'Enviando...' : 'Solicitar retiro'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ===== estilos (copiados/adaptados) ===== */
const backdrop = { position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }
const card = { width: '100%', maxWidth: 680, background: 'linear-gradient(180deg, #071026 0%, #081426 100%)', color: '#EDF2F7', borderRadius: 16, padding: '24px', position: 'relative', boxShadow: '0 18px 48px rgba(2,6,23,0.75)', fontFamily: '"Rubik", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial' }
const closeBtn = { position: 'absolute', right: 16, top: 16, background: 'transparent', border: 'none', color: '#9CA3AF', fontSize: 18, cursor: 'pointer' }
const content = { display: 'flex', flexDirection: 'column', gap: 20, alignItems: 'center', textAlign: 'center' }
const header = { marginBottom: 2 }
const title = { margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff' }
const subtitle = { margin: 0, marginTop: 6, fontSize: 13, color: '#BBD2E6' }
const bigValuesRow = { width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12, alignItems: 'stretch' }
const bigValueCard = { background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', border: '1px solid rgba(255,255,255,0.04)', borderRadius: 12, padding: '18px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', justifyContent: 'center', minHeight: 110 }
const bigLabel = { fontSize: 13, color: '#9FB4C8', fontWeight: 700, textTransform: 'uppercase' }
const bigValue = { fontSize: 28, fontWeight: 900, color: '#E6EEF7', letterSpacing: '-0.02em' }
const amountInput = { width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#E6EEF7', fontSize: 16, textAlign: 'center' }
const insufficientBanner = { marginTop: 12, background: 'linear-gradient(90deg, rgba(252,165,165,0.06), rgba(252,165,165,0.04))', color: '#FCA5A5', padding: '10px 14px', borderRadius: 10, fontWeight: 800, width: '100%', textAlign: 'center', border: '1px solid rgba(252,165,165,0.08)' }
const infoBox = { width: '100%', background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))', borderRadius: 10, padding: 12, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center' }
const actions = { display: 'flex', gap: 12, justifyContent: 'center', marginTop: 6, width: '100%' }
const outlineBtn = { padding: '10px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#E6EEF7', cursor: 'pointer' }
const secondaryBtn = { padding: '12px 16px', borderRadius: 10, background: '#E6EEF7', color: '#081426', fontWeight: 800, border: 'none', cursor: 'pointer', minWidth: 120 }
const confirmBtn = (disabled) => ({ padding: '12px 16px', borderRadius: 10, background: disabled ? 'linear-gradient(90deg, #94A3B8, #6B7280)' : 'linear-gradient(90deg, #06B6D4, #10B981)', color: disabled ? '#E6EEF7' : '#021018', fontWeight: 900, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer', minWidth: 220 })
const centerSection = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 18 }
const muted = { color: '#9FB4C8' }
const errorText = { color: '#FCA5A5', textAlign: 'center' }