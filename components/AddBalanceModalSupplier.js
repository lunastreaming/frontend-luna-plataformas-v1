import { useState, useEffect } from 'react'
import Modal from './Modal'

export default function AddBalanceModalSupplier({ open, onClose, onAdd }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('PEN')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // exchange info (rate: PEN per 1 USD)
  const [rate, setRate] = useState(null)
  const [loadingRate, setLoadingRate] = useState(false)
  const [rateError, setRateError] = useState(null)

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    if (!open) {
      setAmount('')
      setCurrency('PEN')
      setError(null)
      setSubmitting(false)
      setRate(null)
      setRateError(null)
      setLoadingRate(false)
      return
    }

    // si se abre el modal y la moneda es USD, obtener rate
    if (open && currency === 'USD') {
      fetchRate().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    // si el usuario cambia a USD mientras está abierto y no hay rate, fetch
    if (open && currency === 'USD' && rate == null && !loadingRate) {
      fetchRate().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currency, open])

  async function fetchRate() {
    setRateError(null)
    setLoadingRate(true)
    try {
      const res = await fetch(`${BASE_URL}/api/categories/exchange/current`)
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const json = await res.json()
      const r = json?.rate ?? json?.value ?? null
      if (r == null) throw new Error('Tipo de cambio no disponible')
      const num = typeof r === 'number' ? r : parseFloat(String(r))
      if (Number.isNaN(num) || num <= 0) throw new Error('Tipo de cambio inválido')
      setRate(num)
      setLoadingRate(false)
      return num
    } catch (err) {
      console.error('fetchRate error', err)
      setRate(null)
      setRateError(err?.message || String(err))
      setLoadingRate(false)
      throw err
    }
  }

  const getMinForCurrencyNumber = () => {
    const minPen = 10
    if (currency === 'PEN') return Number(minPen.toFixed(2))
    if (!rate || rate <= 0) return null
    // USD = 10 PEN / rate (rate = PEN per 1 USD)
    const usdMinRaw = minPen / rate
    const usdMin = Number(usdMinRaw.toFixed(2)) // round to 2 decimals
    return usdMin
  }

  const submit = async () => {
    setError(null)
    const parsed = parseFloat(amount)
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Ingresa un monto válido mayor a 0')
      return
    }

    if (currency === 'PEN') {
      const min = 10
      const parsedRounded = Number(parsed.toFixed(2))
      if (parsedRounded < min) {
        setError(`El monto mínimo para Soles es ${min.toFixed(2)} PEN`)
        return
      }
    } else if (currency === 'USD') {
      if (rate == null) {
        setError('No se pudo obtener el tipo de cambio. Intenta nuevamente.')
        return
      }
      const minUsd = getMinForCurrencyNumber()
      if (minUsd == null) {
        setError('Tipo de cambio inválido. No se puede validar mínimo en USD.')
        return
      }
      const parsedRounded = Number(parsed.toFixed(2))
      if (parsedRounded < minUsd) {
        setError(`El monto mínimo es ${minUsd.toFixed(2)} USD`)
        return
      }
    }

    setSubmitting(true)
    try {
      // enviamos amount con 2 decimales normalizados (no convertimos a centavos aquí)
      await onAdd({ amount: Number(parseFloat(amount).toFixed(2)), currency })
      setSubmitting(false)
      onClose()
    } catch (err) {
      setSubmitting(false)
      setError(err?.message || 'Error al procesar el depósito')
    }
  }

  const minDisplay = (() => {
    if (currency === 'PEN') return '10.00 PEN'
    if (currency === 'USD') {
      if (loadingRate) return 'Cargando tipo de cambio…'
      if (rateError) return 'Tipo de cambio no disponible'
      if (rate == null) return 'Tipo de cambio no disponible'
      const minUsd = getMinForCurrencyNumber()
      return `${minUsd.toFixed(2)} USD`
    }
    return ''
  })()

  return (
    <Modal open={open} onClose={() => { if (!submitting) onClose(); }} ariaLabel="Agregar saldo">
      <div className="modal-header">
        <h2>Agregar saldo</h2>
        <button className="close" onClick={() => { if (!submitting) onClose(); }} aria-label="Cerrar">✕</button>
      </div>

      <div className="field">
        <label>Monto</label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          disabled={submitting}
        />
        <div className="min-info">Mínimo: <strong>{minDisplay}</strong></div>
      </div>

      <div className="field">
        <label>Moneda</label>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} disabled={submitting}>
          <option value="PEN">Soles (PEN)</option>
          <option value="USD">Dólares (USD)</option>
        </select>
      </div>

      {error && <div className="error">{error}</div>}
      {rateError && currency === 'USD' && <div className="error">Error tipo de cambio: {rateError}</div>}

      <div className="actions">
        <button className="btn ghost" onClick={() => { if (!submitting) onClose(); }} disabled={submitting}>Cancelar</button>
        <button className="btn primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Agregar'}
        </button>
      </div>

      <style jsx>{`
        .modal-header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; }
        h2 { margin:0; font-size:1.1rem; color:#f3f3f3; }
        .close { background:transparent; border:none; color:#cfcfcf; font-size:1.05rem; cursor:pointer; }
        .field { display:flex; flex-direction:column; gap:6px; margin:10px 0; }
        label { color:#bfbfbf; font-size:0.9rem; }
        input, select {
          padding:10px 12px;
          border-radius:10px;
          border:1px solid rgba(255,255,255,0.06);
          background: rgba(30,30,30,0.7);
          color:#eee;
          outline:none;
        }
        input::placeholder { color:#8e8e8e; }
        .min-info { color:#9fb4c8; font-size:0.85rem; margin-top:6px; }
        .error { color:#ffb4b4; margin-top:8px; font-size:0.9rem; text-align:center; }
        .actions { display:flex; justify-content:flex-end; gap:10px; margin-top:14px; }
        .btn { padding:10px 14px; border-radius:10px; font-weight:700; cursor:pointer; border:none; }
        .btn.ghost { background:transparent; color:#e6e6e6; border:1px solid rgba(255,255,255,0.06); }
        .btn.primary { background:linear-gradient(135deg,#8b5cf6 0%,#22d3ee 100%); color:#0d0d0d; }
      `}</style>
    </Modal>
  )
}