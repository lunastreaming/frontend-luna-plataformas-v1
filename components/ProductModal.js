import { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { FaTimes } from 'react-icons/fa'

// 🔧 Configura tus credenciales de Cloudinary
const CLOUDINARY_UPLOAD_PRESET = 'streamingluna_unsigned'
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/dgzmzsgi8/image/upload'

const initialForm = {
  name: '',
  categoryId: '',
  terms: '',
  productDetail: '',
  requestDetail: '',
  days: '',
  salePrice: '',
  renewalPrice: '',
  isRenewable: false,
  isOnRequest: false,
  imageUrl: ''
}

export default function ProductModal({ visible, onClose, onSuccess, initialData = null }) {
  const [mounted, setMounted] = useState(false)
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState(initialForm)
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/categories`)
      .then(res => res.json())
      .then(setCategories)
      .catch(() => setCategories([]))
  }, [])

  // preload form when opening for edit
  useEffect(() => {
    if (!visible) {
      setForm(initialForm)
      return
    }
    if (initialData) {
      setForm({
        name: initialData.name ?? '',
        categoryId: initialData.categoryId?.toString?.() ?? '',
        terms: initialData.terms ?? '',
        productDetail: initialData.productDetail ?? '',
        requestDetail: initialData.requestDetail ?? '',
        days: initialData.days ?? '',
        // precios vienen del backend como BigDecimal (decimales), se muestran tal cual
        salePrice: initialData.salePrice != null ? String(initialData.salePrice) : '',
        renewalPrice: initialData.renewalPrice != null ? String(initialData.renewalPrice) : '',
        isRenewable: !!initialData.isRenewable,
        isOnRequest: !!initialData.isOnRequest,
        imageUrl: initialData.imageUrl ?? ''
      })
    } else {
      setForm(initialForm)
    }
  }, [visible, initialData])

  if (!mounted || !visible) return null

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleImageUpload = async (file) => {
    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

    try {
      const res = await fetch(CLOUDINARY_URL, {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (data.secure_url) {
        setForm(prev => ({ ...prev, imageUrl: data.secure_url }))
      } else {
        throw new Error('No secure_url returned from Cloudinary')
      }
    } catch (err) {
      alert('Error subiendo imagen: ' + (err.message || err))
    } finally {
      setUploading(false)
    }
  }

  const toDecimal = (val) => {
    if (val === undefined || val === null || val === '') return null
    const f = parseFloat(String(val).replace(',', '.'))
    return Number.isNaN(f) ? null : f
  }

  const toInteger = (val) => {
    if (val === undefined || val === null || val === '') return null
    const n = parseInt(String(val), 10)
    return Number.isNaN(n) ? null : n
  }

  const resetForm = () => setForm(initialForm)

  const handleSubmit = async () => {
    try {
      if (!form.name || !form.categoryId || !form.salePrice) {
        alert('Nombre, categoría y precio de venta son obligatorios')
        return
      }

      if (uploading) {
        alert('Espera a que la imagen termine de subirse')
        return
      }

      setSubmitting(true)

      const payload = {
        name: String(form.name).trim(),
        categoryId: toInteger(form.categoryId),
        terms: form.terms?.trim() || null,
        productDetail: form.productDetail?.trim() || null,
        requestDetail: form.requestDetail?.trim() || null,
        days: toInteger(form.days),
        // ahora se envían decimales directamente (BigDecimal en backend)
        salePrice: toDecimal(form.salePrice),
        renewalPrice: toDecimal(form.renewalPrice),
        isRenewable: !!form.isRenewable,
        isOnRequest: !!form.isOnRequest,
        imageUrl: form.imageUrl || null
      }

      const filteredPayload = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v === undefined ? null : v])
      )

      const token = localStorage.getItem('accessToken')

      if (initialData && initialData.id) {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products/${initialData.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(filteredPayload)
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Error ${res.status} ${text}`)
        }

        const updated = await res.json()
        onSuccess(updated)
        resetForm()
        onClose()
      } else {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/products`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(filteredPayload)
        })

        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`Error ${res.status} ${text}`)
        }

        const created = await res.json()
        onSuccess(created)
        resetForm()
        onClose()
      }
    } catch (err) {
      alert('Error al guardar producto: ' + (err.message || err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const title = initialData && initialData.id ? '✏️ Editar producto' : '🛒 Nuevo producto'
  const submitLabel = initialData && initialData.id ? (submitting ? 'Guardando...' : 'Guardar cambios') : (submitting ? 'Creando...' : 'Guardar')

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 2147483647,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 0 20px rgba(0,0,0,0.3)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '1.5rem',
        position: 'relative'
      }}>
        <button onClick={handleClose} style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1.25rem'
        }}>
          <FaTimes />
        </button>

        <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: '600' }}>
          {title}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <input name="name" placeholder="Nombre" value={form.name} onChange={handleChange} />
          <select name="categoryId" value={form.categoryId} onChange={handleChange}>
            <option value="">Selecciona categoría</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <textarea name="terms" placeholder="Condiciones de uso" value={form.terms} onChange={handleChange} />
          <textarea name="productDetail" placeholder="Detalle del producto" value={form.productDetail} onChange={handleChange} />
          <textarea name="requestDetail" placeholder="Detalle de la solicitud" value={form.requestDetail} onChange={handleChange} />
          <input type="number" name="days" placeholder="Días" value={form.days} onChange={handleChange} />
          <input type="text" name="salePrice" placeholder="Precio de venta (ej. 4.09)" value={form.salePrice} onChange={handleChange} />
          <input type="text" name="renewalPrice" placeholder="Precio de renovación (ej. 6.09)" value={form.renewalPrice} onChange={handleChange} />
          <label><input type="checkbox" name="isRenewable" checked={form.isRenewable} onChange={handleChange} /> Renovable</label>
          <label><input type="checkbox" name="isOnRequest" checked={form.isOnRequest} onChange={handleChange} /> A solicitud</label>

          <input type="file" accept="image/*" onChange={(e) => {
            const file = e.target.files[0]
            if (file) handleImageUpload(file)
          }} />
          {uploading && <div style={{ fontSize: '0.9rem', color: '#555' }}>Subiendo imagen…</div>}
          {form.imageUrl && (
            <img
              src={form.imageUrl}
              alt="Preview"
              style={{ width: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '6px' }}
            />
          )}
        </div>

        <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
          <button onClick={handleClose} style={{
            marginRight: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#e2e8f0',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}>Cancelar</button>
          <button onClick={handleSubmit} disabled={uploading || submitting} style={{
            padding: '0.5rem 1rem',
            backgroundColor: (uploading || submitting) ? '#a0aec0' : '#3182ce',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (uploading || submitting) ? 'not-allowed' : 'pointer'
          }}>{submitLabel}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}