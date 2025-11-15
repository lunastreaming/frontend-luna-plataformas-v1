// components/StockModal.jsx
import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
import { FaTimes } from 'react-icons/fa'

export default function StockModal({
  visible,
  onClose,
  onSuccess,
  initialData = null,
  initialProducts = null // opcional: pasar lista ya cargada desde el padre
}) {
  const [mounted, setMounted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [products, setProducts] = useState([])

  const [form, setForm] = useState({
    productId: '',
    username: '',
    password: '',
    url: '',
    tipo: 'CUENTA',
    numeroPerfil: '',
    pin: ''
  })

  function resetForm() {
    setForm({
      productId: '',
      username: '',
      password: '',
      url: '',
      tipo: 'CUENTA',
      numeroPerfil: '',
      pin: ''
    })
    setSubmitting(false)
  }

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!visible) {
      resetForm()
      return
    }

    // Si el padre pasó productos reutilízalos, sino haz fetch
    if (Array.isArray(initialProducts) && initialProducts.length > 0) {
      const normalized = normalizeProductsArray(initialProducts)
      setProducts(normalized)
      setLoadingProducts(false)
    } else {
      loadProducts()
    }

    if (initialData) {
      setForm({
        productId: initialData.productId ?? (initialData.product?.id ?? ''),
        username: initialData.username ?? '',
        password: initialData.password ?? '',
        url: initialData.url ?? '',
        tipo: initialData.tipo ?? 'CUENTA',
        numeroPerfil: initialData.numeroPerfil ?? '',
        pin: initialData.pin ?? ''
      })
    }
  }, [visible, initialData, initialProducts])

  if (!mounted || !visible) return null

  // Helper: retorna header Authorization o null si no hay token
  function getAuthHeader() {
    const token = localStorage.getItem('accessToken')
    console.debug('[StockModal] accessToken present?', !!token)
    return token ? { Authorization: `Bearer ${token}` } : null
  }

  // Normaliza un array que puede venir como:
  // - [{ product: {...}, stockResponses: [...] }, ...]
  // - [{ id, name, ... }, ...]
  function normalizeProductsArray(raw) {
    if (!Array.isArray(raw)) return []
    return raw
      .map(item => {
        const product = item?.product ?? item
        return {
          id: product?.id ?? null,
          name: product?.name ?? product?.title ?? 'Sin nombre',
          imageUrl: product?.imageUrl ?? product?.thumbnail ?? null
        }
      })
      .filter(p => p.id)
  }

  async function loadProducts() {
    setLoadingProducts(true)
    try {
      const headers = getAuthHeader()
      const url = `${process.env.NEXT_PUBLIC_API_URL}/api/products/provider/me`

      console.debug('[StockModal] fetching products from', url, 'withAuth?', !!headers)

      // Si no hay token, intentamos la petición sin Authorization (backend puede devolver 401/403)
      const fetchOptions = headers ? { headers } : {}

      const res = await fetch(url, fetchOptions)
      const text = await res.text().catch(() => '')
      console.debug('[StockModal] products fetch status', res.status, 'body:', text)

      if (!res.ok) {
        // Lanzar error con cuerpo para diagnóstico
        throw new Error(`Error ${res.status}: ${text || res.statusText}`)
      }

      const raw = text ? JSON.parse(text) : []
      const normalized = normalizeProductsArray(raw)
      setProducts(normalized)
    } catch (err) {
      console.error('Error cargando productos:', err)
      setProducts([])
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const validate = () => {
    if (!form.productId) { alert('Selecciona un producto'); return false }
    if (!form.username?.trim()) { alert('El campo Username es obligatorio'); return false }
    if (form.tipo === 'PERFIL') {
      if (form.numeroPerfil === '') { alert('Indica la cantidad de perfiles'); return false }
      const n = Number(form.numeroPerfil)
      if (!Number.isInteger(n) || n < 1) { alert('Número de perfil debe ser un entero mayor o igual a 1'); return false }
      if (n > 7) { alert('Máximo 7 stocks por operación'); return false }
    }
    if (form.numeroPerfil !== '' && isNaN(Number(form.numeroPerfil))) { alert('Número de perfil debe ser un número válido'); return false }
    return true
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    try {
      const headersAuth = getAuthHeader()
      if (!headersAuth) {
        alert('No estás autenticado. Inicia sesión e intenta nuevamente.')
        setSubmitting(false)
        return
      }

      // Editar existente (PUT)
      if (initialData && initialData.id) {
        const payload = {
          productId: form.productId,
          username: form.username.trim(),
          password: form.password || null,
          url: form.url || null,
          tipo: form.tipo,
          numeroPerfil: form.numeroPerfil === '' ? null : Number(form.numeroPerfil),
          pin: form.pin || null
        }

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/${initialData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...headersAuth },
          body: JSON.stringify(payload)
        })
        const txt = await res.text().catch(() => '')
        if (!res.ok) throw new Error(`Error ${res.status}: ${txt || res.statusText}`)
        const data = txt ? JSON.parse(txt) : {}
        onSuccess(data)
        onClose()
        return
      }

      // Creación: batch endpoint (como en tu implementación original)
      let stocksToSend = []

      if (form.tipo === 'CUENTA') {
        stocksToSend.push({
          productId: form.productId,
          username: form.username.trim(),
          password: form.password || null,
          url: form.url || null,
          tipo: 'CUENTA',
          numeroPerfil: null,
          pin: form.pin || null
        })
      } else {
        const n = Number(form.numeroPerfil || 0)
        const capped = Math.min(n, 7)
        for (let i = 1; i <= capped; i++) {
          stocksToSend.push({
            productId: form.productId,
            username: form.username.trim(),
            password: form.password || null,
            url: form.url || null,
            tipo: 'PERFIL',
            numeroPerfil: i,
            pin: form.pin || null
          })
        }
      }

      const body = { stocks: stocksToSend }

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/stocks/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headersAuth },
        body: JSON.stringify(body)
      })

      const txt = await res.text().catch(() => '')
      if (!res.ok) throw new Error(`Error ${res.status}: ${txt || res.statusText}`)
      const resp = txt ? JSON.parse(txt) : {}
      const created = resp?.created ?? resp?.createdStocks ?? resp ?? []

      onSuccess(created)
      onClose()
    } catch (err) {
      console.error('Error guardando stock batch:', err)
      alert('No se pudo guardar el stock: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  return ReactDOM.createPortal(
    <div style={backdrop}>
      <div role="dialog" aria-modal="true" aria-label={initialData && initialData.id ? 'Editar stock' : 'Nuevo stock'} style={modal}>
        <button onClick={() => { resetForm(); onClose() }} aria-label="Cerrar" style={closeBtn}><FaTimes /></button>

        <h2 style={title}>{initialData && initialData.id ? '✏️ Editar stock' : '➕ Nuevo stock'}</h2>

        <form onSubmit={(e) => { e.preventDefault(); handleSubmit() }} style={formGrid}>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Producto</label>
            <select
              name="productId"
              value={form.productId}
              onChange={handleChange}
              style={input}
              disabled={loadingProducts}
              aria-required="true"
            >
              <option value="">{loadingProducts ? 'Cargando productos…' : 'Selecciona producto'}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!loadingProducts && products.length === 0 && (
              <div style={{ marginTop: 8, color: '#6b7280', fontSize: 13 }}>
                No se encontraron productos para tu cuenta. Verifica tu sesión o recarga la página.
              </div>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Username</label>
            <input name="username" value={form.username} onChange={handleChange} placeholder="Usuario" style={input} />
          </div>

          <div>
            <label style={label}>Password</label>
            <input name="password" value={form.password} onChange={handleChange} placeholder="Password" style={{ ...input, fontFamily: 'monospace' }} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>URL</label>
            <input name="url" value={form.url} onChange={handleChange} placeholder="https://..." style={input} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>Tipo</label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label style={radioLabel}>
                <input type="radio" name="tipo" value="CUENTA" checked={form.tipo === 'CUENTA'} onChange={handleChange} />
                <span>Cuenta</span>
              </label>
              <label style={radioLabel}>
                <input type="radio" name="tipo" value="PERFIL" checked={form.tipo === 'PERFIL'} onChange={handleChange} />
                <span>Perfil</span>
              </label>
            </div>
          </div>

          <div>
            <label style={label}>Número de perfil</label>
            <input name="numeroPerfil" value={form.numeroPerfil} onChange={handleChange} placeholder="123" style={input} />
            <div style={{ marginTop: 6, color: '#6b7280', fontSize: 12 }}>
              {form.tipo === 'PERFIL' ? 'Se crearán N stocks con numeroPerfil de 1..N (máx 7)' : 'Usado solo para PERFIL'}
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={label}>PIN</label>
            <input name="pin" value={form.pin} onChange={handleChange} placeholder="PIN" style={input} />
          </div>

          <div style={{ gridColumn: '1 / -1', textAlign: 'right', marginTop: 8 }}>
            <button type="button" onClick={() => { resetForm(); onClose() }} style={cancelBtn}>Cancelar</button>
            <button type="submit" disabled={submitting} style={submitBtn(submitting)}>
              {submitting ? 'Guardando...' : (initialData && initialData.id ? 'Guardar cambios' : 'Crear')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

/* ====== estilos inline reutilizables ====== */

const backdrop = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.5)',
  zIndex: 2147483647,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}

const modal = {
  backgroundColor: 'white',
  borderRadius: 8,
  boxShadow: '0 0 20px rgba(0,0,0,0.3)',
  width: '92%',
  maxWidth: 600,
  maxHeight: '90vh',
  overflowY: 'auto',
  padding: '1.25rem',
  position: 'relative'
}

const closeBtn = {
  position: 'absolute',
  top: 10,
  right: 10,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontSize: 18
}

const title = { marginBottom: 12, fontSize: 18, fontWeight: 700 }

const formGrid = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 12
}

const label = { display: 'block', marginBottom: 6, fontWeight: 600 }

const input = { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db' }

const radioLabel = { display: 'flex', alignItems: 'center', gap: 8 }

const cancelBtn = {
  marginRight: 8,
  padding: '0.5rem 1rem',
  backgroundColor: '#e2e8f0',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer'
}

const submitBtn = (disabled) => ({
  padding: '0.5rem 1rem',
  backgroundColor: disabled ? '#a0aec0' : '#3182ce',
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: disabled ? 'not-allowed' : 'pointer'
})