// pages/registersupplier.js
import { useState, useEffect, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Select, { components } from 'react-select'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faLock, faHashtag } from '@fortawesome/free-solid-svg-icons'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import countriesData from '../../data/countries.json' // ajusta ruta si tu estructura difiere

// Flag helper (FlagCDN)
const flagPngUrl = (iso2) => `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`

function OptionWithFlag(props) {
  const { data } = props
  const iso = data.value
  const alt = `${data.name} flag`
  return (
    <components.Option {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={flagPngUrl(iso)}
          alt={alt}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
            const parent = e.currentTarget.parentElement
            if (parent && data.flag) {
              const el = document.createElement('span')
              el.textContent = data.flag
              el.style.fontSize = '14px'
              parent.insertBefore(el, e.currentTarget)
            }
          }}
          style={{ width: 28, height: 18, objectFit: 'cover', borderRadius: 2 }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 14, color: '#EEE' }}>{data.name}</div>
          <div style={{ fontSize: 12, color: '#9A9A9A' }}>{`+${data.dial}`}</div>
        </div>
      </div>
    </components.Option>
  )
}

function SingleValueWithFlag(props) {
  const { data } = props
  const iso = data.value
  return (
    <components.SingleValue {...props}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <img
          src={flagPngUrl(iso)}
          alt={`${data.name} flag`}
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2 }}
        />
        <span style={{ color: '#F0F0F0' }}>{data.name} (+{data.dial})</span>
      </div>
    </components.SingleValue>
  )
}

export default function RegisterSupplier() {
  const router = useRouter()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('') // local phone digits only
  const [refCode, setRefCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [loadingCountries, setLoadingCountries] = useState(true)

  useEffect(() => {
    try {
      setLoadingCountries(true)
      const mapped = countriesData
        .map(c => ({
          label: `${c.flag ? c.flag + ' ' : ''}${c.name} (+${c.dial})`,
          value: c.code,        // ISO2 uppercase required for FlagCDN
          name: c.name,
          dial: String(c.dial).replace(/\D/g, ''),
          flag: c.flag || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setCountries(mapped)
      const defaultCountry = mapped.find(c => c.name.toLowerCase().includes('peru')) || mapped[0]
      setSelectedCountry(defaultCountry)
      // keep phone input empty (user types local number)
      setPhone('')
    } finally {
      setLoadingCountries(false)
    }
  }, [])

  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/register`

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)

    if (!username || !password || !phone) {
      setError('Todos los campos son obligatorios')
      return
    }
    if (!selectedCountry) {
      setError('Selecciona tu país')
      return
    }

    // normalize phone digits and build E.164-like with selected dial
    const localDigits = phone.replace(/\D/g, '')
    const fullPhone = `+${String(selectedCountry.dial).replace(/\D/g, '')}${localDigits}`

    const payload = {
      username: username.trim(),
      password,
      phone: fullPhone,
      role: 'provider',
      referrerCode: refCode?.trim() || null,
    }

    setLoading(true)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        let msg = `Error ${res.status}`
        try {
          const json = await res.json()
          // if backend returns technical codes like message: "phone_taken"
          if (json?.message === 'phone_taken') {
            msg = 'El número de teléfono ya está registrado'
          } else if (json?.message === 'username_taken') {
            msg = 'El nombre de usuario ya está en uso'
          } else if (json?.detail) {
            msg = json.detail
          } else if (json?.message) {
            msg = json.message
          }
        } catch (_) {}
        throw new Error(msg)
      }

      setSuccess(true)
      setTimeout(() => router.push('/supplier/loginSupplier'), 1800)
    } catch (err) {
      setError(err.message || 'Error al registrar')
    } finally {
      setLoading(false)
    }
  }

  const selectComponents = useMemo(() => ({ Option: OptionWithFlag, SingleValue: SingleValueWithFlag }), [])
  const selectStyles = {
    control: (base) => ({ ...base, backgroundColor: 'transparent', border: 'none', boxShadow: 'none', cursor: 'pointer', minWidth: 140, height: 44 }),
    singleValue: (base) => ({ ...base, color: '#F0F0F0', fontSize: '0.88rem' }),
    menu: (base) => ({ ...base, backgroundColor: '#131313', borderRadius: 14 }),
    option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#232323' : '#131313', color: '#F0F0F0', fontSize: '0.88rem' }),
    indicatorsContainer: (base) => ({ ...base, display: 'none' }),
    placeholder: (base) => ({ ...base, color: '#9A9A9A' }),
  }

  return (
    <>
      <Head><title>Registro Proveedor | Luna Streaming</title></Head>
      <div className="canvas">
        <form className="card" onSubmit={handleRegister}>
          <h1 className="title">Registro Proveedor</h1>
          <p className="subtitle">Crea tu cuenta de proveedor</p>

          {error && <div className="error" role="alert">{error}</div>}

          <div className="group"><FontAwesomeIcon icon={faUser} /><input type="text" placeholder="Usuario" value={username} onChange={e => setUsername(e.target.value)} /></div>
          <div className="group"><FontAwesomeIcon icon={faLock} /><input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} /></div>

          <div className="group whatsapp">
            <div className="select-country">
              <Select
                options={countries}
                value={selectedCountry}
                onChange={opt => setSelectedCountry(opt)}
                placeholder={loadingCountries ? '...' : 'País'}
                isDisabled={loadingCountries}
                components={selectComponents}
                styles={selectStyles}
              />
            </div>

            <div className="cell-input-wrapper">
              <div className="input-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faWhatsapp} />
              </div>
              <input
                type="tel"
                placeholder="Celular"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="group"><FontAwesomeIcon icon={faHashtag} /><input type="text" placeholder="Código de referencia" value={refCode} onChange={e => setRefCode(e.target.value)} /></div>

          <button type="submit" className="cta" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarme'}
          </button>

          <p className="back-login">
            ¿Ya tienes cuenta? <span className="link" onClick={() => router.push('/supplier/loginSupplier')}>Ir al login</span>
          </p>
        </form>
      </div>

      {success && (
        <div className="popup">
          <div className="popup-content">
            <h2>Registro exitoso</h2>
            <p>Redirigiendo al login...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        .canvas {
          min-height: 100vh;
          background: radial-gradient(circle at 20% 10%, #1a1a1a, #0e0e0e);
          display: grid;
          place-items: center;
          padding: 24px;
        }
        .card {
          background: rgba(22,22,22,0.6);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          padding: 28px;
          width: 92%;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .title { font-size: 1.8rem; font-weight: 800; text-align: center; color: #f3f3f3; }
        .subtitle { text-align: center; color: #afafaf; font-size: 0.95rem; margin-bottom: 6px; }
        .error { color: #ffb4b4; text-align: center; font-size: 0.95rem; }

        .group {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(30,30,30,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 10px 14px;
        }
        .group input {
          flex: 1;
          background: transparent;
          border: none;
          color: #f5f5f5;
          font-size: 1rem;
          outline: none;
        }

        /* whatsapp row */
        .group.whatsapp {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 8px;
          align-items: center;
        }
        .select-country {
          background: rgba(30,30,30,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          height: 44px;
          display: flex;
          align-items: center;
          padding: 0 8px;
        }

        .cell-input-wrapper {
          position: relative;
          display: block;
        }
        .cell-input-wrapper input {
          padding-left: 40px;
          width: 100%;
          height: 44px;
          border-radius: 10px;
          border: none;
          background: transparent;
          color: #f5f5f5;
          outline: none;
          font-size: 1rem;
        }
        .input-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #25D366;
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .cta {
          padding: 12px;
          background: linear-gradient(135deg, #8b5cf6, #22d3ee);
          color: #0e0e0e;
          border: none;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
        }
        .back-login { text-align: center; font-size: 0.95rem; color: #afafaf; }
        .link { color: #f3f3f3; font-weight: 600; text-decoration: underline; cursor: pointer; }

        .popup {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: grid;
          place-items: center;
          z-index: 999;
        }
        .popup-content {
          background: rgba(20,20,20,0.85);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(12px);
          border-radius: 18px;
          padding: 24px;
          max-width: 420px;
          width: 92%;
          text-align: center;
          color: #ededed;
          box-shadow: 0 24px 48px rgba(0,0,0,0.45);
        }

        @media (max-width: 640px) {
          .group.whatsapp { grid-template-columns: 112px 1fr; }
          .select-country { min-width: 112px; }
          .input-icon { left: 10px; font-size: 16px; }
          .cell-input-wrapper input { padding-left: 36px; }
        }
      `}</style>
    </>
  )
}