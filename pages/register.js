import { useState, useEffect, useMemo } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import Select, { components } from 'react-select'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser, faLock, faHashtag } from '@fortawesome/free-solid-svg-icons'
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons'
import countriesData from '../data/countries.json' // Ajusta la ruta si necesitas

// Helpers para banderas (FlagCDN)
const flagPngUrl = (iso2) => `https://flagcdn.com/w40/${iso2.toLowerCase()}.png`

// Custom option con imagen + fallback emoji
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

export default function Register() {
  const router = useRouter()

  // Form fields
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [whatsapp, setWhatsapp] = useState('') // solo dígitos del número (sin prefijo)
  const [refCode, setRefCode] = useState('')

  // Countries & selection
  const [countries, setCountries] = useState([])
  const [selectedCountry, setSelectedCountry] = useState(null)
  const [loadingCountries, setLoadingCountries] = useState(true)

  // API / UI
  const [showSuccess, setShowSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Validation
  const [errors, setErrors] = useState({ username: null, password: null, phone: null })
  const [touched, setTouched] = useState({ username: false, password: false, phone: false })
  const [submitAttempt, setSubmitAttempt] = useState(false)

  useEffect(() => {
    try {
      setLoadingCountries(true)
      const mapped = countriesData
        .map(c => ({
          label: `${c.flag ? c.flag + ' ' : ''}${c.name} (+${c.dial})`,
          value: c.code,           // ISO2 uppercase
          name: c.name,
          dial: String(c.dial).replace(/\D/g, ''), // digits only
          flag: c.flag || null
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
      setCountries(mapped)
      const defaultCountry = mapped.find(c => c.name.toLowerCase().includes('peru')) || mapped[0]
      setSelectedCountry(defaultCountry)
    } finally {
      setLoadingCountries(false)
    }
  }, [])

  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/auth/register`

  const validateUsername = value => {
    if (!value || !value.trim()) return 'El usuario es obligatorio'
    if (value.trim().length < 3) return 'El usuario debe tener al menos 3 caracteres'
    return null
  }
  const validatePassword = value => {
    if (!value) return 'La contraseña es obligatoria'
    if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres'
    return null
  }
  const validatePhone = (phoneRaw) => {
    if (!phoneRaw) return 'El número es obligatorio'
    const digits = phoneRaw.replace(/\D/g, '')
    if (digits.length < 6) return 'Número demasiado corto'
    if (digits.length > 20) return 'Número demasiado largo'
    return null
  }

  useEffect(() => { setErrors(prev => ({ ...prev, username: validateUsername(username) })) }, [username])
  useEffect(() => { setErrors(prev => ({ ...prev, password: validatePassword(password) })) }, [password])
  useEffect(() => { setErrors(prev => ({ ...prev, phone: validatePhone(whatsapp) })) }, [whatsapp])

  const handleBlur = field => setTouched(prev => ({ ...prev, [field]: true }))
  const handleWhatsAppChange = e => setWhatsapp(e.target.value.replace(/\D/g, ''))
  const showFieldError = field => errors[field] && (touched[field] || submitAttempt)

  // map backend codes to friendly messages
  const backendMessageMap = {
    username_taken: 'El nombre de usuario ya está en uso',
    phone_taken: 'El número de teléfono ya está registrado',
  }

  const handleRegister = async e => {
    e.preventDefault()
    setError(null)
    setSubmitAttempt(true)

    const uErr = validateUsername(username)
    const pErr = validatePassword(password)
    const phErr = validatePhone(whatsapp)
    setErrors({ username: uErr, password: pErr, phone: phErr })

    if (uErr || pErr || phErr) {
      setError('Corrige los errores del formulario')
      return
    }

    if (!selectedCountry) {
      setError('Selecciona tu país')
      return
    }

    setLoading(true)

    // Construimos el número asegurando un único '+' y solo dígitos después
    const localDigits = whatsapp.replace(/\D/g, '')
    const phone = `+${String(selectedCountry.dial).replace(/\D/g, '')}${localDigits}`

    const payload = {
      username: username.trim(),
      password,
      phone,
      role: 'seller',
      referrerCode: refCode?.trim() || null,
    }

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!resp.ok) {
        // Intentamos parsear JSON del backend
        let parsed = null
        try { parsed = await resp.json() } catch (_) { parsed = null }

        // Si viene un objeto errors por campo, lo aplicamos
        if (parsed && parsed.errors && typeof parsed.errors === 'object') {
          const newErr = { username: null, password: null, phone: null }
          for (const k of Object.keys(parsed.errors)) {
            if (k === 'username' || k === 'phone' || k === 'password') {
              newErr[k] = Array.isArray(parsed.errors[k]) ? parsed.errors[k].join(', ') : String(parsed.errors[k])
            }
          }
          setErrors(prev => ({ ...prev, ...newErr }))
          setError(parsed.message || 'Errores de validación')
        } else if (parsed && parsed.message) {
          // Backend devuelve un código técnico en message, por ejemplo "username_taken"
          const key = parsed.message
          if (backendMessageMap[key]) {
            // Asignamos mensaje amigable al campo correspondiente
            if (key === 'username_taken') {
              setErrors(prev => ({ ...prev, username: backendMessageMap[key] }))
            } else if (key === 'phone_taken') {
              setErrors(prev => ({ ...prev, phone: backendMessageMap[key] }))
            }
            setError(parsed.detail || backendMessageMap[key])
          } else if (parsed.detail) {
            setError(parsed.detail)
          } else {
            setError(parsed.message || `Error en el registro (${resp.status})`)
          }
        } else {
          setError(`Error en el registro (${resp.status})`)
        }

        throw new Error('backend_error')
      }

      setShowSuccess(true)
      setTimeout(() => router.push('/login'), 1600)
    } catch (err) {
      if (err.message !== 'backend_error') {
        setError(err.message || 'Error desconocido al registrar')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => router.push('/')

  // Select components/styles
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
      <Head><title>Registro | Luna Streaming</title></Head>

      <div className="canvas">
        <form className="card" onSubmit={handleRegister} noValidate>
          <button type="button" className="close" onClick={handleClose} aria-label="Cerrar">✕</button>

          <h1 className="title">Regístrate</h1>
          <p className="subtitle">Regístrate a Luna</p>

          {error && <div className="form-error" role="alert">{error}</div>}

          <div className="group">
            <div className="icon"><FontAwesomeIcon icon={faUser} /></div>
            <input
              type="text"
              placeholder="Usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onBlur={() => handleBlur('username')}
              required
              aria-invalid={!!errors.username}
              aria-describedby="username-error"
            />
            <span className="underline" />
          </div>
          {showFieldError('username') && <div id="username-error" className="field-error">{errors.username}</div>}

          <div className="group">
            <div className="icon"><FontAwesomeIcon icon={faLock} /></div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onBlur={() => handleBlur('password')}
              required
              aria-invalid={!!errors.password}
              aria-describedby="password-error"
            />
            <span className="underline" />
          </div>
          {showFieldError('password') && <div id="password-error" className="field-error">{errors.password}</div>}

          {/* Whatsapp group: Select (country) + input (cell) with whatsapp icon inside the input */}
          <div className="group whatsapp">
            {/* select-country column */}
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

            {/* input column */}
            <div className="cell-input-wrapper">
              {/* icon positioned inside input */}
              <div className="input-icon" aria-hidden="true">
                <FontAwesomeIcon icon={faWhatsapp} />
              </div>

              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Celular"
                value={whatsapp}
                onChange={handleWhatsAppChange}
                onBlur={() => handleBlur('phone')}
                required
                aria-invalid={!!errors.phone}
                aria-describedby="phone-error"
              />
            </div>

            <span className="underline" />
          </div>
          {showFieldError('phone') && <div id="phone-error" className="field-error">{errors.phone}</div>}

          <div className="group">
            <div className="icon"><FontAwesomeIcon icon={faHashtag} /></div>
            <input
              type="text"
              placeholder="Código de referencia"
              value={refCode}
              onChange={e => setRefCode(e.target.value)}
            />
            <span className="underline" />
          </div>

          <button type="submit" className="cta" disabled={loading}>
            {loading ? 'Registrando...' : 'Registrarme'}
          </button>

          <p className="back-login">
            ¿Ya tienes una cuenta?{' '}
            <span className="link" onClick={() => router.push('/login')}>Volver al login</span>
          </p>
        </form>
      </div>

      {showSuccess && (
        <div className="popup" role="dialog" aria-modal="true">
          <div className="popup-content">
            <div className="check">✔</div>
            <h2>Registro exitoso</h2>
            <p>Serás redirigido al login en breve...</p>
            <button className="popup-button" onClick={() => router.push('/login')}>Ir ahora</button>
          </div>
        </div>
      )}

      <style jsx>{`
        .canvas {
          min-height: 100vh;
          background: radial-gradient(1200px 600px at 20% 10%, #1a1a1a 0%, #0e0e0e 60%, #0b0b0b 100%);
          position: relative;
          display: grid;
          place-items: center;
          overflow: hidden;
          padding: 40px 12px;
        }
        .card {
          width: 92%;
          max-width: 520px;
          background: rgba(22,22,22,0.6);
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(16px);
          border-radius: 20px;
          padding: 28px;
          box-shadow: 0 30px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 14px;
          position: relative;
        }
        .close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: #cfcfcf;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          cursor: pointer;
        }
        .title { color: #f3f3f3; font-size: 1.9rem; text-align: center; font-weight: 800; }
        .subtitle { color: #afafaf; font-size: 0.98rem; text-align: center; margin-bottom: 6px; }

        .form-error { color: #ffb4b4; text-align:center; margin-bottom: 6px; }
        .group {
          position: relative;
          display: flex;
          align-items: center;
          background: rgba(30,30,30,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          padding: 8px 10px;
        }
        .group:focus-within { border-color: #8b5cf6; background: rgba(30,30,30,0.85); }
        .icon { position: absolute; left: 12px; display:flex; align-items:center; color:#cfcfcf; font-size:1rem; }
        .group input {
          width: 100%;
          padding: 12px 14px 12px 44px;
          background: transparent;
          border: none;
          border-radius: 10px;
          color: #f5f5f5;
          font-size: 1rem;
          outline: none;
        }
        .group input::placeholder { color: #8e8e8e; }

        /* --- Whatsapp specific layout --- */
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

        /* wrapper around the input to position icon inside the input */
        .cell-input-wrapper {
          position: relative;
          display: block;
        }
        .cell-input-wrapper input {
          padding-left: 40px; /* leave room for the whatsapp icon */
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
          color: #25D366; /* whatsapp green */
          font-size: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }

        .underline { position: absolute; bottom: 6px; left: 44px; right: 10px; height: 2px; background: linear-gradient(90deg, transparent, rgba(139,92,246,0.8), transparent); border-radius:2px; opacity:0; transform:scaleX(0.8); transition:opacity .2s, transform .2s;}
        .group:focus-within .underline { opacity:1; transform:scaleX(1); }

        .field-error { color:#ffb4b4; font-size:12px; margin-top:-6px; margin-bottom:6px; }

        .cta {
          padding: 12px 16px;
          background: linear-gradient(135deg,#8b5cf6 0%,#22d3ee 100%);
          color: #0e0e0e;
          border: none;
          border-radius: 14px;
          font-weight: 800;
          cursor: pointer;
        }

        .back-login { text-align: center; font-size: 0.95rem; color: #afafaf; margin-top: 8px; }
        .link { color: #f3f3f3; font-weight: 600; cursor: pointer; text-decoration: underline; }

        .popup { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display:grid; place-items:center; z-index:999; }
        .popup-content { background: rgba(20,20,20,0.85); border-radius:18px; padding:24px; text-align:center; color:#ededed; }
        .check { width:56px; height:56px; border-radius:50%; display:grid; place-items:center; margin:0 auto 10px; background: linear-gradient(135deg,#22d3ee 0%,#8b5cf6 100%); color:#0e0e0e; font-weight:900; }
        .popup-button { padding:10px 14px; background:#f3f3f3; color:#0e0e0e; border:none; border-radius:12px; font-weight:800; cursor:pointer; }

        @media (max-width: 640px) {
          .group.whatsapp { grid-template-columns: 112px 1fr; }
          .select-country { min-width: 112px; }
          .input-icon { left: 10px; font-size:16px; }
          .cell-input-wrapper input { padding-left: 36px; }
        }
      `}</style>
    </>
  )
}