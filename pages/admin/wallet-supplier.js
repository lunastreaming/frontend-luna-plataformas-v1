// pages/admin/wallet-supplier.js
import { useEffect, useState } from 'react'
import Head from 'next/head'
import AdminNavBar from '../../components/AdminNavBar'
import ConfirmModal from '../../components/ConfirmModal'
import { useAuth } from '../../context/AuthProvider'
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa'

export default function WalletSupplierPending() {
  const { ensureValidAccess, logout } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState({})
  const [error, setError] = useState(null)

  const BASE = process.env.NEXT_PUBLIC_API_URL || ''

  const [confirmData, setConfirmData] = useState({
    open: false,
    id: null,
    action: null,
    message: ''
  })

  useEffect(() => {
    fetchPending()
  }, [])

  const getAuthToken = async () => {
    try {
      const t = typeof ensureValidAccess === 'function' ? await ensureValidAccess() : null
      if (t) return t
    } catch (_) {}
    if (typeof window !== 'undefined') return localStorage.getItem('accessToken')
    return null
  }

  const fetchPending = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getAuthToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const res = await fetch(`${BASE}/api/wallet/admin/pending-provider`, {
        method: 'GET',
        headers,
        credentials: token ? 'omit' : 'include'
      })

      if (res.status === 401) {
        try { logout() } catch (_) {}
        throw new Error('No autorizado')
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => null)
        throw new Error(txt || `Error ${res.status}`)
      }

      const data = await res.json()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching pending wallet approvals:', err)
      setError('No se pudieron cargar las solicitudes pendientes')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const performAction = async (id, action) => {
    setActionLoading(prev => ({ ...prev, [id]: true }))
    setError(null)
    try {
      const token = await getAuthToken()
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const url = action === 'approve'
        ? `${BASE}/api/wallet/admin/approve/${id}`
        : `${BASE}/api/wallet/admin/reject/${id}`

      const res = await fetch(url, {
        method: 'POST',
        headers,
        credentials: token ? 'omit' : 'include',
        body: JSON.stringify({})
      })

      if (res.status === 401) {
        try { logout() } catch (_) {}
        throw new Error('No autorizado')
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => null)
        throw new Error(txt || `Error ${res.status}`)
      }

      setItems(prev => prev.filter(i => i.id !== id))
    } catch (err) {
      console.error(`Error ${action} wallet request ${id}:`, err)
      setError(`No se pudo ${action === 'approve' ? 'aprobar' : 'rechazar'} la solicitud`)
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: false }))
    }
  }

  const requestActionWithConfirm = (id, action, userName, amount) => {
    const actionText = action === 'approve' ? 'aprobar' : 'rechazar'
    const message = `¿Seguro que quieres ${actionText} la recarga de ${userName ?? 'este proveedor'} por ${typeof amount === 'number' ? amount.toFixed(2) : amount}?`
    setConfirmData({ open: true, id, action, message })
  }

  const handleConfirm = async () => {
    const { id, action } = confirmData
    setConfirmData(prev => ({ ...prev, open: false }))
    if (!id || !action) return
    await performAction(id, action)
  }

  const handleCancelConfirm = () => {
    setConfirmData({ open: false, id: null, action: null, message: '' })
  }

  return (
    <>
      <Head>
        <title>Recargas Pendientes Proveedores | Admin</title>
      </Head>

      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-white">
        <AdminNavBar />

        <main className="max-w-6xl mx-auto px-6 py-10">
          <header className="mb-6 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Recargas pendientes (Proveedores)</h1>
              <p className="text-sm text-gray-400">Aprobar o rechazar recargas solicitadas por proveedores</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={fetchPending}
                className="refresh-btn"
                aria-label="Refrescar lista"
              >
                <FaSpinner className="spin" />
                <span className="sr-only">Refrescar</span>
              </button>
            </div>
          </header>

          {error && <div className="error-msg">{error}</div>}

          {loading ? (
            <div className="grid gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="card skeleton" key={i} />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="empty">No hay recargas pendientes</div>
          ) : (
            <div className="grid-cards">
              {items.map(item => (
                <article className="card" key={item.id}>
                  <div className="card-left">
                    {/* Mostrar el campo user del backend */}
                    <div className="user">{item.user ?? 'Proveedor'}</div>
                    <div className="meta">{item.method ? item.method : 'Método'}</div>
                    <div className="date">{new Date(item.createdAt ?? Date.now()).toLocaleString()}</div>
                  </div>

                  <div className="card-right">
                    <div className="amount">{typeof item.amount === 'number' ? item.amount.toFixed(2) : item.amount}</div>

                    <div className="actions">
                      <button
                        className="btn-approve"
                        onClick={() => requestActionWithConfirm(item.id, 'approve', item.user, item.amount)}
                        disabled={Boolean(actionLoading[item.id])}
                        aria-label={`Aprobar recarga ${item.id}`}
                      >
                        {actionLoading[item.id] ? <FaSpinner className="spin small" /> : <FaCheckCircle />}
                      </button>

                      <button
                        className="btn-reject"
                        onClick={() => requestActionWithConfirm(item.id, 'reject', item.user, item.amount)}
                        disabled={Boolean(actionLoading[item.id])}
                        aria-label={`Rechazar recarga ${item.id}`}
                      >
                        {actionLoading[item.id] ? <FaSpinner className="spin small" /> : <FaTimesCircle />}
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <ConfirmModal
        open={confirmData.open}
        title={confirmData.action === 'approve' ? 'Confirmar aprobación' : 'Confirmar rechazo'}
        message={confirmData.message}
        confirmText={confirmData.action === 'approve' ? 'Aprobar' : 'Rechazar'}
        cancelText="Cancelar"
        onConfirm={handleConfirm}
        onCancel={handleCancelConfirm}
        loading={Boolean(confirmData.open && confirmData.id && actionLoading[confirmData.id])}
      />
            <style jsx>{`
        .error-msg {
          max-width: 720px;
          margin: 0 auto 12px;
          padding: 10px 12px;
          background: rgba(239, 68, 68, 0.08);
          color: #fecaca;
          border: 1px solid rgba(239,68,68,0.12);
          border-radius: 10px;
        }

        .empty {
          max-width: 720px;
          margin: 16px auto;
          color: #9aa0a6;
          padding: 18px;
          text-align: center;
          border-radius: 10px;
          background: rgba(255,255,255,0.02);
        }

        .grid-cards {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        @media (max-width: 900px) {
          .grid-cards { grid-template-columns: 1fr; }
        }

        .card {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.04);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }

        .card-left { display:flex; flex-direction:column; gap:6px; }
        .user { font-weight:800; color:#fff; }
        .meta { color:#bdbdbd; font-size:0.9rem; }
        .date { color:#9aa0a6; font-size:0.8rem; }

        .card-right { display:flex; align-items:center; gap:12px; }
        .amount { font-weight:900; color:#fff; font-size:1.05rem; min-width:96px; text-align:right; }

        .actions { display:flex; gap:8px; align-items:center; }

        .btn-approve, .btn-reject, .refresh-btn {
          width:44px; height:44px; display:inline-grid; place-items:center; border-radius:10px; border:0; cursor:pointer;
        }

        .btn-approve { background: linear-gradient(135deg,#06b6d4 0%, #34d399 100%); color: #07101a; box-shadow: 0 8px 18px rgba(52,211,153,0.06); }
        .btn-reject { background: linear-gradient(135deg,#f97316 0%, #ef4444 100%); color: #fff; box-shadow: 0 8px 18px rgba(239,68,68,0.06); }
        .refresh-btn { background: rgba(255,255,255,0.03); color: #d1d1d1; width:40px; height:40px; border-radius:10px; }

        .btn-approve:disabled, .btn-reject:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
        .skeleton { height: 120px; border-radius: 12px; background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.03)); animation: shimmer 1.2s linear infinite; }

        .spin { animation: spin 1s linear infinite; }
        .spin.small { width:16px; height:16px; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}