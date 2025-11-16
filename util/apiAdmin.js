import axios from 'axios'
import { getAdminToken, clearAdminAccess, decodeRole } from './token'

const apiAdmin = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

apiAdmin.interceptors.request.use(cfg => {
  const token = getAdminToken()
  if (token) {
    const role = decodeRole(token)
    if (role !== 'admin') { // rol esperado para administradores
      clearAdminAccess()
      window.dispatchEvent(new CustomEvent('session:admin:logout'))
      throw new axios.Cancel('Wrong role for admin area')
    }
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` }
  }
  return cfg
})

apiAdmin.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    if (status === 401 || status === 403) {
      clearAdminAccess()
      window.dispatchEvent(new CustomEvent('session:admin:logout'))
    }
    return Promise.reject(err)
  }
)

export default apiAdmin