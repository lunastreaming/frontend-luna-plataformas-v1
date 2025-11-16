import axios from 'axios'
import { getSupplierToken, clearSupplierAccess, decodeRole } from './token'

const apiSupplier = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,
})

apiSupplier.interceptors.request.use(cfg => {
  const token = getSupplierToken()
  if (token) {
    const role = decodeRole(token)
    if (role !== 'provider') { // rol esperado para proveedores
      clearSupplierAccess()
      window.dispatchEvent(new CustomEvent('session:supplier:logout'))
      throw new axios.Cancel('Wrong role for supplier area')
    }
    cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${token}` }
  }
  return cfg
})

apiSupplier.interceptors.response.use(
  res => res,
  err => {
    const status = err?.response?.status
    if (status === 401 || status === 403) {
      clearSupplierAccess()
      window.dispatchEvent(new CustomEvent('session:supplier:logout'))
    }
    return Promise.reject(err)
  }
)

export default apiSupplier