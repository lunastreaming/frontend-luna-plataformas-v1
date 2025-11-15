// lib/token.js
const KEY_ACCESS = 'accessToken'
const KEY_ACCESS_EXP = 'accessTokenExpiresAt' // ms since epoch
const KEY_REFRESH = 'refreshToken' // optional if you store it client-side

// Save access token, optional expiresAtMs (ms since epoch)
export function setAccessToken(token, expiresAtMs = null) {
  if (token) {
    localStorage.setItem(KEY_ACCESS, token)
    if (expiresAtMs) localStorage.setItem(KEY_ACCESS_EXP, String(expiresAtMs))
    else localStorage.removeItem(KEY_ACCESS_EXP)
  } else {
    localStorage.removeItem(KEY_ACCESS)
    localStorage.removeItem(KEY_ACCESS_EXP)
  }
}

// Read access token
export function getAccessToken() {
  return localStorage.getItem(KEY_ACCESS)
}

// Get expiry ms (number) or null
export function getAccessExpiry() {
  const v = localStorage.getItem(KEY_ACCESS_EXP)
  return v ? Number(v) : null
}

// Clear tokens
export function clearAccess() {
  localStorage.removeItem(KEY_ACCESS)
  localStorage.removeItem(KEY_ACCESS_EXP)
}

// Decode JWT payload (no deps). Returns payload or null.
export function decodeJwt(token) {
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Convenience: set token and set expiry from JWT exp claim (seconds)
export function setAccessTokenFromJwt(token) {
  if (!token) {
    clearAccess()
    return
  }
  const payload = decodeJwt(token)
  const expSec = payload?.exp
  const expMs = expSec ? expSec * 1000 : null
  setAccessToken(token, expMs)
}

// Returns true if token is missing or exp in past (with optional buffer ms)
export function isAccessTokenExpired(bufferMs = 5000) {
  const token = getAccessToken()
  if (!token) return true
  const expiry = getAccessExpiry()
  if (expiry) return Date.now() + bufferMs >= expiry
  // fallback: decode token
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return Date.now() + bufferMs >= payload.exp * 1000
}