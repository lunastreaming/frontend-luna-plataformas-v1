/*
// lib/token.js

// Utility to namespace keys per area
function key(area, base) {
  return `${area}_${base}`;
}

// Save access token for a given area
export function setAccessToken(area, token, expiresAtMs = null) {
  const KEY_ACCESS = key(area, 'accessToken');
  const KEY_ACCESS_EXP = key(area, 'accessTokenExpiresAt');

  if (token) {
    localStorage.setItem(KEY_ACCESS, token);
    if (expiresAtMs) localStorage.setItem(KEY_ACCESS_EXP, String(expiresAtMs));
    else localStorage.removeItem(KEY_ACCESS_EXP);
  } else {
    localStorage.removeItem(KEY_ACCESS);
    localStorage.removeItem(KEY_ACCESS_EXP);
  }
}

// Read access token for an area
export function getAccessToken(area) {
  return localStorage.getItem(key(area, 'accessToken'));
}

// Get expiry ms (number) or null
export function getAccessExpiry(area) {
  const v = localStorage.getItem(key(area, 'accessTokenExpiresAt'));
  return v ? Number(v) : null;
}

// Clear tokens for an area
export function clearAccess(area) {
  localStorage.removeItem(key(area, 'accessToken'));
  localStorage.removeItem(key(area, 'accessTokenExpiresAt'));
}

// Decode JWT payload (no deps). Returns payload or null.
export function decodeJwt(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Convenience: set token and expiry from JWT exp claim (seconds)
export function setAccessTokenFromJwt(area, token) {
  if (!token) {
    clearAccess(area);
    return;
  }
  const payload = decodeJwt(token);
  const expSec = payload?.exp;
  const expMs = expSec ? expSec * 1000 : null;
  setAccessToken(area, token, expMs);
}

// Returns true if token is missing or exp in past (with optional buffer ms)
export function isAccessTokenExpired(area, bufferMs = 5000) {
  const token = getAccessToken(area);
  if (!token) return true;
  const expiry = getAccessExpiry(area);
  if (expiry) return Date.now() + bufferMs >= expiry;
  const payload = decodeJwt(token);
  if (!payload?.exp) return true;
  return Date.now() + bufferMs >= payload.exp * 1000;
} */