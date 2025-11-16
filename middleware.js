import { NextResponse } from 'next/server'

function decodeJwtPayload(token) {
  try {
    const payload = token.split('.')[1]
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
    return decoded
  } catch {
    return null
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('accessToken')?.value

  // --- Rutas públicas ---
  const publicRoutes = [
    '/login',
    '/register',
    '/admin/loginAdmin',
    '/supplier/loginSupplier',
    '/supplier/registerSupplier'
  ]

  // Si la ruta empieza con alguna pública, deja pasar
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // --- Admin ---
  if (pathname.startsWith('/admin')) {
    if (!token) return NextResponse.redirect(new URL('/admin/loginAdmin', request.url))
    const payload = decodeJwtPayload(token)
    const role = (payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null))?.toUpperCase()
    if (role !== 'ADMIN') return NextResponse.redirect(new URL('/admin/loginAdmin', request.url))
  }

  // --- Supplier ---
  if (pathname.startsWith('/supplier')) {
    if (!token) return NextResponse.redirect(new URL('/supplier/loginSupplier', request.url))
    const payload = decodeJwtPayload(token)
    const role = (payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null))?.toUpperCase()
    if (role !== 'PROVIDER') return NextResponse.redirect(new URL('/supplier/loginSupplier', request.url))
  }

  // --- Usuario por defecto ---
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/supplier')) {
    if (!token) return NextResponse.redirect(new URL('/login', request.url))
    const payload = decodeJwtPayload(token)
    const role = (payload?.role || (Array.isArray(payload?.roles) ? payload.roles[0] : null))?.toUpperCase()
    if (role !== 'USER') return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/supplier/:path*'] // quita '/:path*' para no atrapar todo
}