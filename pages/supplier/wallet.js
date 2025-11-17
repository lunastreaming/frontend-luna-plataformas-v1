import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import NavBarSupplier from '../../components/NavBarSupplier';
import Footer from '../../components/Footer';
import AddBalanceModal from '../../components/AddBalanceModalSupplier';
import ConfirmModal from '../../components/ConfirmModal';
import LiquidarModal from '../../components/LiquidarModal';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';

export default function BilleteraSupplier() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [movimientos, setMovimientos] = useState([]);
  const [pending, setPending] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [liquidarOpen, setLiquidarOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTargetId, setConfirmTargetId] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const hasFetched = useRef(false);

  // BASE desde variable de entorno (SSR-safe)
  const rawApiBase = process.env.NEXT_PUBLIC_API_URL;
  const apiBase = rawApiBase ? rawApiBase.replace(/\/+$/, '') : '';

  // Aviso sólo en cliente para evitar diferencias SSR/CSR
  useEffect(() => {
    if (!rawApiBase) {
      console.warn('NEXT_PUBLIC_API_URL no está definida. Usando rutas relativas.');
    }
  }, [rawApiBase]);

  // util: construir endpoint sin duplicar slashes
  const buildUrl = (path) => `${apiBase}${path.startsWith('/') ? '' : '/'}${path}`;

  useEffect(() => {
    if (!router.isReady || hasFetched.current) return;

    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    if (!token) {
      router.push('/supplier/loginSupplier');
      return;
    }

    hasFetched.current = true;
    (async () => {
      try {
        await fetchMeAndPopulate(token);
        await fetchPendingRequests(token);
        await fetchUserTransactions(token);
      } catch (err) {
        console.error('Error inicial:', err);
        router.push('/supplier/loginSupplier');
      }
    })();
  }, [router.isReady]);

  async function fetchMeAndPopulate(token) {
    const res = await fetch(buildUrl('/api/users/me'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Token inválido');
    const data = await res.json();
    setBalance(parseFloat(data.balance) || 0);
    if (Array.isArray(data.movements)) setMovimientos(data.movements);
  }

  async function fetchUserTransactions(token) {
    const res = await fetch(buildUrl('/api/wallet/user/transactions?status=complete'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setMovimientos(data);
  }

  async function fetchPendingRequests(token) {
    const res = await fetch(buildUrl('/api/wallet/user/pending'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json();
    if (Array.isArray(data)) setPending(data);
    else if (Array.isArray(data.pending)) setPending(data.pending);
  }

  const handleAddClick = () => setModalOpen(true);
  const handleTransferClick = () => router.push('/supplier/transferencia');
  // antes navegábamos a otra página; ahora abrimos el modal de liquidar
  const handleLiquidarClick = () => {
    setModalOpen(false); // opcional: cerrar add-balance si estaba abierto
    setLiquidarOpen(true);
  };

  const handleAdd = async ({ amount, currency }) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
    const res = await fetch(buildUrl('/api/wallet/recharge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, isSoles: currency === 'PEN' }),
    });
    if (!res.ok) return;
    await fetchMeAndPopulate(token);
    await fetchPendingRequests(token);
    await fetchUserTransactions(token);
  };

  return (
    <>
      <NavBarSupplier />
      <main className="wallet-container">
        <section className="balance-card">
          <div className="balance-header">
            <h2>Saldo disponible</h2>
            <button className="btn-transfer" onClick={handleTransferClick} aria-label="Transferir">
              <FontAwesomeIcon icon={faExchangeAlt} />
            </button>
          </div>
          <div className="balance-row">
            <div className="balance-amount">${balance.toFixed(2)}</div>
            <div className="balance-actions">
              <button className="btn-add" onClick={handleAddClick}>Agregar saldo</button>
              <button className="btn-liquidar" onClick={handleLiquidarClick}>Liquidar</button>
            </div>
          </div>
        </section>

        {pending.length > 0 && (
          <section className="pending-card">
            <h3>Solicitudes pendientes</h3>
            <ul className="pending-list">
              {pending.map((p) => (
                <li key={p.id || p.requestId}>
                  <div className="pending-info">
                    <div className="pending-amt">{p.currency || 'PEN'} {Number(p.amount).toFixed(2)}</div>
                    <div className="pending-meta">
                      <div className="pending-desc">{p.description || 'Solicitud de recarga'}</div>
                      <div className="pending-date">{p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}</div>
                    </div>
                  </div>
                  <div className="pending-actions">
                    <button className="btn-cancel" onClick={() => setConfirmTargetId(p.id || p.requestId)}>Eliminar</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="movements-card">
          <h3>Movimientos</h3>
          <ul className="pending-list movements-as-pending">
            {movimientos.length === 0 && <li className="empty">No hay movimientos</li>}
            {movimientos.map((m) => (
              <li key={m.id}>
                <div className="pending-info">
                  <div className="pending-amt">{m.currency || 'PEN'} {Number(m.amount).toFixed(2)}</div>
                  <div className="pending-meta">
                    <div className="pending-desc">{m.desc || m.description || 'Transacción'}</div>
                    <div className="pending-date">{m.date ? new Date(m.date).toLocaleString() : ''}</div>
                  </div>
                </div>
                <div className="pending-actions">
                  <span className={`tx-badge ${m.status === 'approved' || m.status === 'complete' ? 'approved' : m.status === 'pending' ? 'pending' : 'rejected'}`}>
                    {m.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <Footer />
      <AddBalanceModal open={modalOpen} onClose={() => setModalOpen(false)} onAdd={handleAdd} />
      <LiquidarModal
        open={liquidarOpen}
        onClose={() => setLiquidarOpen(false)}
        onDone={() => {
          const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
          if (token) {
            fetchMeAndPopulate(token);
            fetchPendingRequests(token);
            fetchUserTransactions(token);
          }
        }}
      />
      <ConfirmModal
        open={confirmOpen}
        loading={confirmLoading}
        title="Confirmar cancelación"
        message="¿Deseas cancelar esta solicitud pendiente?"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {}}
      />

      <style jsx>{`
        .wallet-container {
          min-height: 80vh;
          padding: 60px 24px;
          background: #0d0d0d;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        .balance-card,
        .movements-card,
        .pending-card {
          width: 100%;
          max-width: 680px;
          background: rgba(22, 22, 22, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 18px;
          box-shadow: 0 12px 24px rgba(0, 0, 0, 0.4);
          color: #f3f3f3;
        }

        .balance-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .btn-transfer {
          background: transparent;
          border: none;
          color: #22d3ee;
          font-size: 1.2rem;
          cursor: pointer;
          transition: transform 0.2s ease;
        }

        .btn-transfer:hover {
          transform: scale(1.1);
        }

        .balance-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          flex-wrap: wrap;
        }

        .balance-amount {
          font-size: 2.2rem;
          font-weight: 800;
        }

        .balance-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .btn-add {
          padding: 10px 16px;
          background: linear-gradient(135deg, #8b5cf6 0%, #22d3ee 100%);
          color: #0d0d0d;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          font-size: 0.95rem;
        }

        .btn-liquidar {
          padding: 10px 16px;
          background: linear-gradient(135deg, #f87171 0%, #fbbf24 100%);
          color: #0d0d0d;
          border: none;
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          font-size: 0.95rem;
        }

        .btn-cancel {
          background: transparent;
          color: #ffdede;
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 8px 12px;
          border-radius: 10px;
          font-weight: 600;
          font-size: 0.85rem;
        }

        .btn-add:hover,
        .btn-liquidar:hover,
        .btn-cancel:hover {
          filter: brightness(1.05);
        }

        .pending-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .pending-list li {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px;
          border-radius: 10px;
          background: rgba(10, 10, 10, 0.35);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .pending-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .pending-amt {
          font-weight: 800;
          color: #ffd166;
          min-width: 110px;
        }

        .pending-meta {
          color: #cfcfcf;
          font-size: 0.95rem;
        }

        .pending-desc {
          font-weight: 700;
          color: #e6e6e6;
        }

        .pending-date {
          color: #a6a6a6;
          font-size: 0.85rem;
        }

        .pending-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .tx-badge {
          padding: 6px 10px;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.75rem;
          color: #07101a;
        }

        .tx-badge.approved {
          background: linear-gradient(90deg,#bbf7d0,#34d399);
          color:#04261a;
        }

        .tx-badge.pending {
          background: linear-gradient(90deg,#fef3c7,#f59e0b);
          color:#3a2700;
        }

        .tx-badge.rejected {
          background: linear-gradient(90deg,#fecaca,#fb7185);
          color:#2b0404;
        }

        @media (max-width: 640px) {
          .balance-amount {
            font-size: 1.8rem;
          }
          .pending-amt {
            min-width: 90px;
          }
        }
      `}</style>
    </>
  );
}