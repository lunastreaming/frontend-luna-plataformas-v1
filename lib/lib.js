// lib/api.js
import axios from 'axios'
import { getAccessToken, setAccessTokenFromJwt, clearAccess, isAccessTokenExpired } from './token'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080',
  withCredentials: true, // si el refresh usa cookie httpOnly
})

// --- request interceptor: check expiry BEFORE sending ---
api.interceptors.request.use(async (cfg) => {
  const token = getAccessToken()
  if (token) {
    if (isAccessTokenExpired()) {
      // token expirado: no lo adjuntes
      cfg.headers = cfg.headers || {}
      delete cfg.headers.Authorization
    } else {
      cfg.headers = cfg.headers || {}
      cfg.headers.Authorization = `Bearer ${token}`
    }
  }
  return cfg
})

// --- response interceptor: refresh-on-401 with queue ---
let isRefreshing = false
let queue = []

function processQueue(err, token = null) {
  queue.forEach(prom => (err ? prom.reject(err) : prom.resolve(token)))
  queue = []
}

async function doRefresh() {
  try {
    const r = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
    const newAccess = r.data?.accessToken
    if (newAccess) setAccessTokenFromJwt(newAccess)
    return newAccess
  } catch (e) {
    return null
  }
}

api.interceptors.response.use(
  res => res,
  async (error) => {
    const { config, response } = error
    if (!config || !response) return Promise.reject(error)

    // --- 401: intentar refresh ---
    if (response.status === 401 && !config._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject })
        }).then(token => {
          if (token) {
            config.headers = config.headers || {}
            config.headers.Authorization = `Bearer ${token}`
          }
          return axios(config)
        }).catch(err => Promise.reject(err))
      }

      config._retry = true
      isRefreshing = true

      try {
        const newToken = await doRefresh()
        if (!newToken) {
          clearAccess()
          window.dispatchEvent(new CustomEvent('session:logout'))
          return Promise.reject(error)
        }
        processQueue(null, newToken)
        config.headers = config.headers || {}
        config.headers.Authorization = `Bearer ${newToken}`
        return axios(config)
      } catch (e) {
        processQueue(e, null)
        clearAccess()
        window.dispatchEvent(new CustomEvent('session:logout'))
        return Promise.reject(e)
      } finally {
        isRefreshing = false
      }
    }

    // --- 403: forzar logout inmediato ---
    if (response.status === 403) {
      clearAccess()
      window.dispatchEvent(new CustomEvent('session:logout'))
    }

    return Promise.reject(error)
  }
)

export default api