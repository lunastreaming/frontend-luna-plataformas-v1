'use client'

import React, { useEffect, useState } from 'react'
import AdminNavBar from '../../components/AdminNavBar'
import Footer from '../../components/Footer'
import { FaSearch, FaRedoAlt } from 'react-icons/fa'

export default function AdminTransactionsPage() {
  const [items, setItems] = useState([])
  const [page, setPage] = useState(0)
  const [size] = useState(100)
  const [totalPages, setTotalPages] = useState(1)
  const [totalElements, setTotalElements] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const BASE_URL = process.env.NEXT_PUBLIC_API_URL || ''

  useEffect(() => {
    let mounted = true

    const fetchPage = async (p = 0) => {
      setLoading(true)
      setError(null)
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
        if (!token) throw new Error('No token')

        const url = `${BASE_URL}/api/wallet/transactions?page=${p}`
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })

        if (!res.ok) {
          const txt = await res.text().catch(() => '')
          throw new Error(`Error ${res.status} ${txt}`)
        }

        const payload = await res.json()
        if (!mounted) return

        const content = Array.isArray(payload?.content) ? payload.content : []
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
  }, [page, BASE_URL, size])

  // Filtered list for display (search across productName, productCode, userName)
  const displayed = items.filter(it =>
    ((it.productName ?? '') + ' ' + (it.productCode ?? '') + ' ' + (it.userName ?? '')).toLowerCase().includes(search.toLowerCase())
  )

  const formatDate = (v) => v ? new Date(v).toLocaleString() : '—'
  const formatAmount = (v, curr = 'USD') => v == null ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(Number(v))

  // map state/status to badge class and label
  const stateClass = (s) => {
    const st = String(s ?? '').toLowerCase()
    if (st === 'approved' || st === 'complete' || st === 'success') return 'tx-badge approved'
    if (st === 'pending' || st === 'waiting') return 'tx-badge pending'
    if (st === 'rejected' || st === 'failed' || st === 'cancelled') return 'tx-badge rejected'
    return 'tx-badge neutral'
  }

  return (
    <div className="min-h-screen page-bg text-white font-inter">
      <AdminNavBar />

      <main className="page-container">
        <div className="header-row">
          <div className="search-bar">
            <FaSearch className="search-icon-inline" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="search-input-inline"
              placeholder="Buscar producto, código o username..."
            />
          </div>

          <div className="header-actions">
            <button
              className="btn-action"
              onClick={() => setPage(p => p)} // re-fetch triggered by effect; keep simple
              title="Refrescar"
            >
              <FaRedoAlt />
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? <div className="info">Cargando transacciones…</div> :
            error ? <div className="error">Error: {error}</div> :
              <div className="table-scroll">
                <table className="styled-table" role="table" aria-label="Transacciones">
                  <colgroup>
                    <col style={{ width: '40px' }} />
                    <col style={{ width: '220px' }} />
                    <col style={{ width: '300px' }} />
                    <col style={{ width: '180px' }} />
                    <col style={{ width: '160px' }} />
                    <col style={{ width: '140px' }} />
                    <col style={{ width: '120px' }} />
                    <col style={{ width: '120px' }} />
                    <col />
                  </colgroup>

                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Id</th>
                      <th>Name Product</th>
                      <th>Product Code</th>
                      <th>Username</th>
                      <th>Date</th>
                      <th>Quantity</th>
                      <th>State</th>
                      <th>Setting</th>
                    </tr>
                  </thead>

                  <tbody>
                    {displayed.map((r, i) => (
                      <tr key={r.id ?? i}>
                        <td><div className="row-inner index">{i + 1}</div></td>
                        <td><div className="row-inner">{r.id ?? '—'}</div></td>
                        <td><div className="row-inner td-name" title={r.productName ?? ''}>{r.productName ?? '—'}</div></td>
                        <td><div className="row-inner">{r.productCode ?? '—'}</div></td>
                        <td><div className="row-inner">{r.userName ?? '—'}</div></td>
                        <td><div className="row-inner no-wrap">{formatDate(r.date)}</div></td>
                        <td><div className="row-inner">{formatAmount(r.amount, r.currency ?? 'USD')}</div></td>
                        <td>
                          <div className="row-inner">
                            <span className={stateClass(r.status)}>{(r.status ?? '—').toString().toUpperCase()}</span>
                          </div>
                        </td>
                        <td><div className="row-inner">{r.settings ?? '—'}</div></td>
                      </tr>
                    ))}
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
        .page-container { padding: 60px 24px; max-width:1200px; margin:0 auto; }
        .header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:24px; }
        .search-bar { display:flex; align-items:center; background: rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:0 12px; height:38px; max-width:520px; width:100%; }
        .search-icon-inline { color:#9fb4c8; margin-right:8px; }
        .search-input-inline { flex:1; background:transparent; border:none; color:#fff; outline:none; font-size:0.95rem; }

        .header-actions { display:flex; gap:8px; align-items:center; }
        .btn-action { padding:8px; border-radius:8px; min-width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; border:none; font-weight:700; color:#0d0d0d; background: linear-gradient(135deg,#06b6d4 0%,#8b5cf6 100%); cursor:pointer; }

        .table-wrapper { overflow:hidden; background: rgba(22,22,22,0.6); border:1px solid rgba(255,255,255,0.06); backdrop-filter: blur(12px); border-radius:12px; padding:12px; box-shadow: 0 12px 24px rgba(0,0,0,0.4); }

        .table-scroll { overflow:auto; border-radius:8px; }

        table.styled-table { width:100%; border-collapse:separate; border-spacing:0 12px; color:#e1e1e1; min-width:1100px; }
        thead tr { background: rgba(30,30,30,0.8); text-transform:uppercase; letter-spacing:0.06em; color:#cfcfcf; font-size:0.72rem; }
        thead th { padding:10px; text-align:left; font-weight:700; vertical-align:middle; white-space:nowrap; }

        tbody td { padding:0; vertical-align:middle; }
        .row-inner { display:flex; align-items:center; gap:12px; padding:12px; background-color: rgba(22,22,22,0.6); border-radius:12px; min-height:36px; }
        .row-inner.index { justify-content:center; width:36px; height:36px; padding:0; }
        .td-name { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:420px; }

        .no-wrap { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

        .pager-row { display:flex; justify-content:space-between; align-items:center; margin-top:12px; }
        .pager-info { color:#cbd5e1; }
        .pager-controls { display:flex; gap:8px; }
        .pager-btn { padding:8px 12px; border-radius:8px; border:none; background:rgba(255,255,255,0.03); color:#e1e1e1; cursor:pointer; }
        .pager-btn:disabled { opacity:0.45; cursor:not-allowed; }

        .info { padding:28px; text-align:center; color:#cbd5e1; }
        .error { padding:28px; text-align:center; color:#fca5a5; }

        /* State badges */
        .tx-badge { padding:6px 10px; border-radius:999px; font-weight:700; font-size:0.72rem; text-transform:uppercase; color:#07101a; }
        .tx-badge.approved { background: linear-gradient(90deg,#bbf7d0,#34d399); color:#04261a; }
        .tx-badge.pending { background: linear-gradient(90deg,#fef3c7,#f59e0b); color:#3a2700; }
        .tx-badge.rejected { background: linear-gradient(90deg,#fecaca,#fb7185); color:#2b0404; }
        .tx-badge.neutral { background: rgba(255,255,255,0.04); color:#cfcfcf; }

        /* Horizontal scrollbar themed */
        .table-scroll::-webkit-scrollbar { height:10px; }
        .table-scroll::-webkit-scrollbar-track { background: transparent; }
        .table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(139,92,246,0.9), rgba(34,211,238,0.9));
          border-radius:999px;
          border:2px solid rgba(2,6,23,0.0);
        }
        .table-scroll { scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.9) transparent; }

        @media (max-width: 980px) {
          .page-container { padding: 40px 16px; }
          table.styled-table { min-width:900px; }
        }
        @media (max-width: 640px) {
          .search-input-inline { font-size: 0.9rem; }
          table.styled-table { min-width:700px; }
        }
      `}</style>
    </div>
  )
}