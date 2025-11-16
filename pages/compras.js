'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import { FaEye, FaEyeSlash, FaSearch, FaRedoAlt } from 'react-icons/fa'

export default function ComprasPage() {
  const router = useRouter()

  // leer token sincronamente para evitar flash y mantener orden de hooks
  const [token] = useState(() => {
    if (typeof window === 'undefined') return null
    return localStorage.getItem('accessToken')
  })

  // si no hay token, redirigir y no renderizar nada
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!token) {
      router.replace('/login')
    }
  }, [router, token])

  if (!token) return null

  // --- estado normal (se ejecuta sólo si hay token) ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [size] = useState(20)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [refreshToggle, setRefreshToggle] = useState(false)
  const [visiblePasswords, setVisiblePasswords] = useState(() => new Set())
  const hasFetched = useRef(false)

  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  const formatPrice = (v) => {
    if (v === null || v === undefined) return '—'
    try {
      return moneyFormatter.format(Number(v))
    } catch {
      return '—'
    }
  }

  const normalizeDateOnly = (value) => {
    if (!value) return '—'
    try {
      const d = (value instanceof Date) ? value : new Date(value)
      if (Number.isNaN(d.getTime())) return '—'
      return d.toLocaleDateString()
    } catch {
      return '—'
    }
  }

  const fetchPurchases = useCallback(async () => {
    if (hasFetched.current && page === 0 && !refreshToggle) {
      // allow manual refresh via refreshToggle
    }
    setLoading(true); setError(null)
    try {
      const tokenVal = token
      if (!tokenVal) {
        router.replace('/login')
        return
      }

      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('size', String(size))

      const res = await fetch(`${BASE_URL}/api/stocks/purchases?${params.toString()}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokenVal}`,
          'Content-Type': 'application/json'
        }
      })

      if (res.status === 401) {
        router.replace('/login')
        return
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`Error ${res.status} ${txt}`)
      }

      const payload = await res.json()
      const rawItems = Array.isArray(payload) ? payload : (Array.isArray(payload?.content) ? payload.content : [])
      const normalized = rawItems.map((p, idx) => ({
        id: p.id ?? idx,
        productId: p.productId ?? p.product_id ?? null,
        productName: p.productName ?? p.name ?? '',
        username: p.username ?? '',
        password: p.password ?? '',
        url: p.url ?? null,
        numeroPerfil: p.numeroPerfil ?? p.numero_perfil ?? null,
        pin: p.pin ?? null,
        startAt: p.startAt ?? p.start_at ?? p.soldAt ?? null,
        endAt: p.endAt ?? p.end_at ?? null,
        refund: typeof p.refund !== 'undefined' ? p.refund : null,
        clientName: p.clientName ?? p.client_name ?? '',
        clientPhone: p.clientPhone ?? p.client_phone ?? '',
        providerName: p.providerName ?? p.provider_name ?? p.providerUsername ?? null,
        settings: p.settings ?? p.configurations ?? null,
        status: p.status ?? null
      }))

      setItems(normalized)
      if (!Array.isArray(payload) && typeof payload === 'object') {
        setTotalElements(Number(payload.totalElements ?? payload.total ?? normalized.length))
        setTotalPages(Number(payload.totalPages ?? Math.ceil((payload.totalElements ?? normalized.length) / size) ?? 1))
        setPage(Number(payload.page ?? payload.number ?? page))
      } else {
        setTotalElements(normalized.length)
        setTotalPages(1)
      }
      hasFetched.current = true
    } catch (err) {
      setError(err.message || String(err))
    } finally {
      setLoading(false)
    }
  }, [BASE_URL, page, size, refreshToggle, router, token])

  useEffect(() => { fetchPurchases() }, [fetchPurchases])

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }

  const displayed = items.filter(i => (i.productName ?? '').toLowerCase().includes(search.toLowerCase()))

  const refresh = () => setRefreshToggle(t => !t)
  const goPrev = () => setPage(p => Math.max(0, p - 1))
  const goNext = () => setPage(p => Math.min(totalPages - 1, p + 1))

  return (
    <div className="min-h-screen page-bg text-white font-inter">
      <Navbar />

      <main className="page-container">
        <div className="header-row">
          <div className="search-bar">
            <FaSearch className="search-icon-inline" />
            <input
              type="text"
              placeholder="Buscar producto…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input-inline"
            />
          </div>

          <div className="header-actions">
            <button className="btn-action" onClick={refresh} title="Refrescar"><FaRedoAlt /></button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div className="info">Cargando compras…</div>
          ) : error ? (
            <div className="error">Error: {error}</div>
          ) : displayed.length === 0 ? (
            <div className="info">No hay compras para mostrar</div>
          ) : (
            <div className="table-scroll">
              <table className="styled-table">
                <colgroup>
                  <col style={{ width: '40px' }} />
                  <col style={{ width: '120px' }} />
                  <col />
                  <col style={{ width: '180px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '140px' }} />
                  <col style={{ width: '160px' }} />
                  <col style={{ width: '160px' }} />
                </colgroup>

                <thead>
                  <tr>
                    <th>#</th>
                    <th>Id</th>
                    <th>Producto</th>
                    <th>Username</th>
                    <th>Password</th>
                    <th>URL</th>
                    <th>Nº Perfil</th>
                    <th>Pin</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Refund</th>
                    <th>Cliente</th>
                    <th>Celular</th>
                    <th>Proveedor</th>
                    <th>Configuraciones</th>
                  </tr>
                </thead>

                <tbody>
                  {displayed.map((row, idx) => {
                    const isVisible = visiblePasswords.has(row.id)
                    const masked = row.password ? '••••••••' : '—'
                    return (
                      <tr key={row.id}>
                        <td><div className="row-inner index">{idx + 1}</div></td>
                        <td><div className="row-inner">{row.id}</div></td>
                        <td><div className="row-inner td-name" title={row.productName}>{row.productName}</div></td>
                        <td><div className="row-inner">{row.username || '—'}</div></td>
                        <td>
                          <div className="row-inner password-cell">
                            <div className="pw-text">{isVisible ? (row.password || '—') : masked}</div>
                            <button onClick={() => togglePasswordVisibility(row.id)} className="pw-btn" aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                              {isVisible ? <FaEyeSlash /> : <FaEye />}
                            </button>
                          </div>
                        </td>
                        <td><div className="row-inner">{row.url ? <a href={row.url} target="_blank" rel="noreferrer" className="link">Link</a> : '—'}</div></td>
                        <td><div className="row-inner">{row.numeroPerfil ?? '—'}</div></td>
                        <td><div className="row-inner">{row.pin ?? '—'}</div></td>
                        <td><div className="row-inner no-wrap">{normalizeDateOnly(row.startAt)}</div></td>
                        <td><div className="row-inner no-wrap">{normalizeDateOnly(row.endAt)}</div></td>
                        <td><div className="row-inner">{formatPrice(row.refund)}</div></td>
                        <td><div className="row-inner">{row.clientName || '—'}</div></td>
                        <td><div className="row-inner">{row.clientPhone || '—'}</div></td>
                        <td><div className="row-inner">{row.providerName ?? '—'}</div></td>
                        <td>
                          <div className="row-inner">
                            {row.settings ? <pre className="settings-pre">{typeof row.settings === 'object' ? JSON.stringify(row.settings) : String(row.settings)}</pre> : '—'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pager-row">
          <div className="pager-info">Mostrando {displayed.length} de {totalElements}</div>
          <div className="pager-controls">
            <button onClick={goPrev} disabled={page <= 0} className="pager-btn">Anterior</button>
            <button onClick={goNext} disabled={page >= totalPages - 1} className="pager-btn">Siguiente</button>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        .page-bg {
          background: radial-gradient(circle at top, #0b1220, #05060a);
          min-height: 100vh;
        }
        .page-container {
          padding: 60px 24px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .header-row {
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:24px;
        }
        .search-bar {
          display:flex;
          align-items:center;
          background: rgba(255,255,255,0.03);
          border:1px solid rgba(255,255,255,0.06);
          border-radius:10px;
          padding:0 12px;
          height:38px;
          max-width:520px;
          width:100%;
        }
        .search-icon-inline { color:#9fb4c8; margin-right:8px; }
        .search-input-inline { flex:1; background:transparent; border:none; color:#fff; outline:none; font-size:0.95rem; }

        .header-actions { display:flex; gap:8px; align-items:center; }
        .btn-action { padding:8px; border-radius:8px; min-width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:none; font-weight:700; color:#0d0d0d; background: linear-gradient(135deg,#06b6d4 0%,#8b5cf6 100%); cursor:pointer; }

        .table-wrapper {
          overflow:hidden;
          background: rgba(22,22,22,0.6);
          border:1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(12px);
          border-radius:12px;
          padding:12px;
          box-shadow: 0 12px 24px rgba(0,0,0,0.4);
        }

        /* Contenedor que proporciona el scroll horizontal moderno */
        .table-scroll {
          overflow:auto;
          border-radius:8px;
        }

        /* Estilos de la tabla */
        table.styled-table {
          width:100%;
          border-collapse:separate;
          border-spacing: 0 12px;
          color:#e1e1e1;
          min-width: 1280px; /* forzar ancho mínimo y permitir scroll si viewport es menor */
        }
        thead tr {
          background: rgba(30,30,30,0.8);
          text-transform:uppercase;
          letter-spacing:0.06em;
          color:#cfcfcf;
          font-size:0.72rem;
        }
        thead th { padding:10px; text-align:left; font-weight:700; vertical-align:middle; white-space:nowrap; }

        tbody td { padding:0; vertical-align:middle; }
        .row-inner {
          display:flex;
          align-items:center;
          gap:12px;
          padding:12px;
          background-color: rgba(22,22,22,0.6);
          border-radius:12px;
          min-height:36px;
        }
        .row-inner.index { justify-content:center; width:36px; height:36px; padding:0; }
        .td-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .password-cell { justify-content:space-between; align-items:center; }
        .pw-text { margin-right:8px; }
        .pw-btn { background:transparent; border:none; color:#9fb4c8; cursor:pointer; display:flex; align-items:center; }
        .link { color:#22d3ee; text-decoration:underline; }

        .no-wrap { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .settings-pre { margin:0; white-space:pre-wrap; font-size:12px; color:#dbeafe; }

        .pager-row {
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-top:12px;
        }
        .pager-info { color:#cbd5e1; }
        .pager-controls { display:flex; gap:8px; }
        .pager-btn { padding:8px 12px; border-radius:8px; border:none; background:rgba(255,255,255,0.03); color:#e1e1e1; cursor:pointer; }
        .pager-btn:disabled { opacity:0.4; cursor:not-allowed; }

        .info { padding:28px; text-align:center; color:#cbd5e1; }
        .error { padding:28px; text-align:center; color:#fca5a5; }

        /* Modern horizontal scrollbar — themed */
        .table-scroll::-webkit-scrollbar {
          height: 10px;
        }
        .table-scroll::-webkit-scrollbar-track {
          background: linear-gradient(180deg, rgba(2,6,23,0.0), rgba(2,6,23,0.0));
        }
        .table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(139,92,246,0.9), rgba(34,211,238,0.9));
          border-radius: 999px;
          border: 2px solid rgba(2,6,23,0.0);
        }
        /* Firefox */
        .table-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(139,92,246,0.9) transparent;
        }

        @media (max-width: 980px) {
          .page-container { padding: 40px 16px; }
          table.styled-table { min-width: 1100px; }
        }
        @media (max-width: 640px) {
          .search-input-inline { font-size: 0.9rem; }
          table.styled-table { min-width: 900px; }
        }
      `}</style>
    </div>
  )
}