'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import NavBarSupplier from '../../components/NavBarSupplier'
import Footer from '../../components/Footer'
import { FaSearch, FaRedoAlt, FaEye, FaEyeSlash } from 'react-icons/fa'

export default function ProviderSalesPage() {
  const router = useRouter()

  // --- Hooks (siempre en el mismo orden)
  const [token, setToken] = useState(undefined) // undefined = desconocido; null = sin sesión; string = token
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [size] = useState(20)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState(() => new Set())
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''
  const scrollRef = useRef(null)

  // --- Leer token solo en cliente dentro de useEffect (evita mismatch SSR/CSR)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = localStorage.getItem('accessToken')
    if (!t) setToken(null)
    else setToken(t)
  }, [])

  // --- Redirigir cuando sepamos que no hay token
  useEffect(() => {
    if (token === null) {
      router.replace('/supplier/login')
    }
  }, [token, router])

  // --- Fetch de datos (depende de token)
  useEffect(() => {
    // no intentar fetch si token aún desconocido o es null
    if (typeof window === 'undefined') return
    if (token === undefined) return
    if (token === null) return

    let mounted = true

    const fetchPage = async (p = 0) => {
      setLoading(true)
      setError(null)
      try {
        const url = `${BASE_URL}/api/stocks/provider/sales?page=${p}&size=${size}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })

        if (res.status === 401) {
          // token inválido/expirado -> redirigir
          if (typeof window !== 'undefined') router.replace('/supplier/login')
          return
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(`Error ${res.status} ${txt}`)
        }

        const payload = await res.json()
        if (!mounted) return

        const content = Array.isArray(payload?.content) ? payload.content : (Array.isArray(payload) ? payload : [])
        setItems(content)
        setPage(Number(payload?.number ?? p))
        setTotalElements(Number(payload?.totalElements ?? payload?.total ?? content.length))
        setTotalPages(Number(payload?.totalPages ?? Math.ceil((payload?.totalElements ?? content.length) / size) ?? 1))
      } catch (err) {
        if (!mounted) return
        setError(err.message || String(err))
        setItems([])
        setTotalElements(0)
        setTotalPages(1)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchPage(page)
    return () => { mounted = false }
  }, [page, BASE_URL, size, token, router])

  // --- UI helpers
  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const formatDate = (v) => {
    if (!v) return '—'
    try {
      const d = new Date(v)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleString()
    } catch {
      return '—'
    }
  }

  const formatAmount = (v) => {
    if (v == null) return '—'
    try {
      return Number(v).toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
    } catch {
      return String(v)
    }
  }

  const computeDaysRemaining = (endAt) => {
    if (!endAt) return null
    try {
      const now = new Date()
      const end = new Date(endAt)
      const diffMs = end.getTime() - now.getTime()
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24))
      return days
    } catch {
      return null
    }
  }

  const displayed = items.filter(it => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    return (
      String(it.id ?? '').toLowerCase().includes(q) ||
      String(it.productName ?? '').toLowerCase().includes(q) ||
      String(it.username ?? '').toLowerCase().includes(q) ||
      String(it.clientName ?? '').toLowerCase().includes(q) ||
      String(it.buyerUsername ?? '').toLowerCase().includes(q)
    )
  })

  // --- Render placeholder mientras token === undefined para evitar mismatch
  if (token === undefined) {
    return (
      <div className="min-h-screen page-bg text-white font-inter">
        <NavBarSupplier />
        <main className="page-container">
          <div className="header-row">
            <div className="search-bar" style={{ height: 40, width: '100%', maxWidth: 520 }} />
            <div style={{ width: 40 }} />
          </div>
          <div className="table-wrapper">
            <div style={{ padding: 28, textAlign: 'center', color: '#cbd5e1' }}>Cargando…</div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // si token === null ya redirigimos; no renderizamos nada
  if (token === null) return null

  // --- Render principal (token válido)
  return (
    <div className="min-h-screen page-bg text-white font-inter">
      <NavBarSupplier />

      <main className="page-container">
        <div className="header-row">
          <div className="search-bar">
            <FaSearch className="search-icon-inline" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input-inline"
              placeholder="Buscar id, producto, username, cliente..."
            />
          </div>

          <div className="header-actions">
            <button className="btn-action" onClick={() => setPage(p => p)} title="Refrescar"><FaRedoAlt /></button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? <div className="info">Cargando ventas del proveedor…</div> :
            error ? <div className="error">Error: {error}</div> :
              <div className="table-scroll" ref={scrollRef}>
                <table className="styled-table" role="table" aria-label="Ventas proveedor">
                  <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '260px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '200px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '140px' }} />
                    <col />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Id</th>
                      <th>Nombre producto</th>
                      <th>Username</th>
                      <th>Password</th>
                      <th>URL</th>
                      <th>Nº Perfil</th>
                      <th>Nombre cliente</th>
                      <th>Pin</th>
                      <th>Inicio</th>
                      <th>Fin</th>
                      <th>Desembolso</th>
                      <th>Estado</th>
                      <th>Vendedor</th>
                      <th>Días restantes</th>
                      <th>Configuraciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayed.map((r, i) => {
                      const isVisible = visiblePasswords.has(r.id)
                      const masked = r.password ? '••••••••' : '—'
                      const days = (typeof r.daysRemaining === 'number' && Number.isFinite(r.daysRemaining))
  ? r.daysRemaining
  : computeDaysRemaining(r.endAt)

                      return (
                        <tr key={r.id ?? i}>
                          <td><div className="row-inner index">{i + 1}</div></td>
                          <td><div className="row-inner id-cell">{r.id ?? '—'}</div></td>
                          <td><div className="row-inner td-name" title={r.productName ?? ''}>{r.productName ?? '—'}</div></td>
                          <td><div className="row-inner">{r.username ?? '—'}</div></td>
                          <td>
                            <div className="row-inner password-cell">
                              <div className="pw-text">{isVisible ? (r.password ?? '—') : masked}</div>
                              <button
                                onClick={() => togglePasswordVisibility(r.id)}
                                aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                className="pw-btn"
                              >
                                {isVisible ? <FaEyeSlash /> : <FaEye />}
                              </button>
                            </div>
                          </td>
                          <td><div className="row-inner">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="link">Link</a> : '—'}</div></td>
                          <td><div className="row-inner">{r.numberProfile ?? '—'}</div></td>
                          <td><div className="row-inner">{r.clientName ?? r.buyerUsername ?? '—'}</div></td>
                          <td><div className="row-inner">{r.pin ?? '—'}</div></td>
                          <td><div className="row-inner no-wrap">{formatDate(r.startAt)}</div></td>
                          <td><div className="row-inner no-wrap">{formatDate(r.endAt)}</div></td>
                          <td><div className="row-inner">{formatAmount(r.refund)}</div></td>
                          <td><div className="row-inner"><span className={`tx-badge ${r.status ? r.status.toLowerCase() : 'neutral'}`}>{(r.status ?? '—').toString().toUpperCase()}</span></div></td>
                          <td><div className="row-inner">{r.buyerUsername ?? (r.buyerId ? String(r.buyerId) : '—')}</div></td>
                          <td>
                            <div className="row-inner">
                              {days == null ? '—' : (
                                <span className={`days-pill ${days > 0 ? 'positive' : (days === 0 ? 'today' : 'expired')}`}>
                                  {days}d
                                </span>
                              )}
                            </div>
                          </td>
                          <td><div className="row-inner">{r.published != null ? `published:${r.published}` : '—'}</div></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
          }
        </div>

        <div className="pager-row">
          <div className="pager-info">Mostrando {displayed.length} de {totalElements}</div>
          <div className="pager-controls">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} className="pager-btn" disabled={page <= 0}>Anterior</button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} className="pager-btn" disabled={page >= totalPages - 1}>Siguiente</button>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .page-bg { background: radial-gradient(circle at top, #0b1220, #05060a); min-height:100vh; }
        .page-container { padding: 36px 20px; max-width: 1400px; margin:0 auto; }
        .header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
        .search-bar { display:flex; align-items:center; background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:0 12px; height:40px; max-width:520px; width:100%; }
        .search-icon-inline { color:#9fb4c8; margin-right:8px; }
        .search-input-inline { flex:1; background:transparent; border:none; color:#fff; outline:none; font-size:0.95rem; }

        .header-actions { display:flex; gap:8px; align-items:center; }
        .btn-action { padding:8px; border-radius:8px; min-width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:none; font-weight:700; color:#0d0d0d; background: linear-gradient(135deg,#06b6d4 0%,#8b5cf6 100%); cursor:pointer; }

        .table-wrapper { overflow:hidden; background: rgba(22,22,22,0.6); border:1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); border-radius:12px; padding:12px; box-shadow: 0 12px 24px rgba(0,0,0,0.4); }

        .table-scroll { overflow:auto; border-radius:8px; }

        table.styled-table { width:100%; border-collapse:separate; border-spacing:0 12px; color:#e1e1e1; min-width:1400px; }
        thead tr { background: rgba(30,30,30,0.8); text-transform:uppercase; letter-spacing:0.06em; color:#cfcfcf; font-size:0.72rem; }
        thead th { padding:10px; text-align:left; font-weight:700; vertical-align:middle; white-space:nowrap; }

        tbody td { padding:0; vertical-align:middle; }
        .row-inner { display:flex; align-items:center; gap:12px; padding:12px; background-color: rgba(22,22,22,0.6); border-radius:12px; min-height:36px; }
        .row-inner.index { justify-content:center; width:36px; height:36px; padding:0; }
        .td-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:420px; }
        .id-cell { font-weight:700; color:#cfe8ff; }

        .password-cell { justify-content:space-between; align-items:center; }
        .pw-text { margin-right:8px; }
        .pw-btn { background:transparent; border:none; color:#9fb4c8; cursor:pointer; display:flex; align-items:center; }
        .link { color:#22d3ee; text-decoration:underline; }

        .no-wrap { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .pager-row { display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
        .pager-info { color:#cbd5e1; }
        .pager-controls { display:flex; gap:8px; }
        .pager-btn { padding:8px 12px; border-radius:8px; border:none; background:rgba(255,255,255,0.03); color:#e1e1e1; cursor:pointer; }
        .pager-btn:disabled { opacity:0.45; cursor:not-allowed; }

        .info { padding:28px; text-align:center; color:#cbd5e1; }
        .error { padding:28px; text-align:center; color:#fca5a5; }

        /* status badge variants */
        .tx-badge { padding:6px 10px; border-radius:999px; font-weight:700; font-size:0.75rem; text-transform:uppercase; color:#07101a; }
        .tx-badge.approved, .tx-badge.complete, .tx-badge.success { background: linear-gradient(90deg,#bbf7d0,#34d399); color:#04261a; }
        .tx-badge.pending, .tx-badge.waiting { background: linear-gradient(90deg,#fef3c7,#f59e0b); color:#3a2700; }
        .tx-badge.rejected, .tx-badge.failed, .tx-badge.cancelled { background: linear-gradient(90deg,#fecaca,#fb7185); color:#2b0404; }
        .tx-badge.neutral { background: rgba(255,255,255,0.04); color:#cfcfcf; }

        /* days pill */
        .days-pill { padding:6px 10px; border-radius:999px; font-weight:700; font-size:0.85rem; color:#07101a; }
        .days-pill.positive { background: linear-gradient(90deg,#bbf7d0,#34d399); color:#04261a; }
        .days-pill.today { background: linear-gradient(90deg,#fef3c7,#f59e0b); color:#3a2700; }
        .days-pill.expired { background: linear-gradient(90deg,#fecaca,#fb7185); color:#2b0404; }

        /* modern horizontal scrollbar themed */
        .table-scroll::-webkit-scrollbar { height: 12px; }
        .table-scroll::-webkit-scrollbar-track { background: transparent; }
        .table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(139,92,246,0.9), rgba(34,211,238,0.9));
          border-radius: 999px;
          border: 2px solid rgba(2,6,23,0.0);
        }
        .table-scroll { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.9) transparent; }

        @media (max-width: 1200px) {
          .page-container { padding: 24px 12px; }
          table.styled-table { min-width: 1100px; }
        }
        @media (max-width: 700px) {
          table.styled-table { min-width: 900px; }
          .page-container { padding: 18px 10px; }
        }
      `}</style>
    </div>
  )
}