// pages/index.js
import Head from 'next/head'
import { useState, useRef, useEffect } from 'react'
import Navbar from '../components/Navbar'
import Carrusel from '../components/Carrusel'
import Footer from '../components/Footer'

export default function Home() {
  const [imagenActiva, setImagenActiva] = useState(null)
  const [zoomActivo, setZoomActivo] = useState(false)
  const [zoomOrigin, setZoomOrigin] = useState({ x: '50%', y: '50%' })
  const mediaRef = useRef(null)

  // categorías
  const [categories, setCategories] = useState([])
  const [catLoading, setCatLoading] = useState(true)
  const [catError, setCatError] = useState(null)

  // productos
  const [products, setProducts] = useState([])
  const [prodLoading, setProdLoading] = useState(true)
  const [prodError, setProdError] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null) // null = todos

  // refs para carrusel circular
  const stripRef = useRef(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)
  const [hasOverflow, setHasOverflow] = useState(false)

  // BASE toma la variable de entorno NEXT_PUBLIC_API_URL en build/deployment.
  // Si no existe, mantiene el fallback local. Normaliza quitando slash final.
  const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  const BASE = rawBase.replace(/\/+$/, '')

  // util: construye URL sin duplicar slashes
  const joinApi = (path) => `${BASE}${path.startsWith('/') ? '' : '/'}${path}`

  // Cerrar vista ampliada
  const cerrarVistaAmpliada = () => {
    setImagenActiva(null)
    setZoomActivo(false)
    setZoomOrigin({ x: '50%', y: '50%' })
  }

  const aplicarZoomFocalizado = (e) => {
    e.stopPropagation()
    if (!mediaRef.current) return

    if (zoomActivo) {
      setZoomActivo(false)
      setZoomOrigin({ x: '50%', y: '50%' })
    } else {
      const rect = mediaRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      setZoomOrigin({ x: `${x}%`, y: `${y}%` })
      setZoomActivo(true)
    }
  }

  // Fetch categorías (endpoint público)
  useEffect(() => {
    let mounted = true
    const api = joinApi('/api/categories')

    async function load() {
      setCatLoading(true)
      setCatError(null)
      try {
        const res = await fetch(api, { method: 'GET' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!mounted) return
        const normalized = Array.isArray(data)
          ? data.map((c, i) => ({
              id: c.id ?? c._id ?? i,
              name: c.name ?? c.title ?? 'Sin nombre',
              image: c.image ?? c.imageUrl ?? c.thumbnail ?? null,
              count: c.count ?? c.itemsCount ?? null,
              status: (c.status ?? c.state ?? c.active ?? null)
            }))
          : []

        const onlyActive = normalized.filter(c => {
          const s = (c.status ?? '').toString().toLowerCase()
          return s === 'active' || s === 'true' || s === 'enabled' || s === ''
        })

        onlyActive.sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true }))
        setCategories(onlyActive)
      } catch (err) {
        if (!mounted) return
        console.error('Error cargando categorías:', err)
        setCatError('No se pudieron cargar las categorías')
        setCategories([])
      } finally {
        if (mounted) setCatLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [BASE])

  // Fetch productos activos (todos) o por categoría
  useEffect(() => {
    fetchProducts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory])

  async function fetchProducts() {
    setProdLoading(true)
    setProdError(null)
    try {
      const url = selectedCategory
        ? joinApi(`/api/categories/products/${selectedCategory}/active`)
        : joinApi('/api/categories/products/active')

      console.debug('[fetchProducts] URL =>', url)
      const res = await fetch(url, { method: 'GET' })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status} ${txt}`)
      }

      const data = await res.json()
      console.debug('[fetchProducts] raw response =>', data)

      // Si backend devuelve Page<T> (Spring), extraer content
      let raw = []
      if (Array.isArray(data)) {
        raw = data
      } else if (Array.isArray(data?.content)) {
        raw = data.content
      } else if (Array.isArray(data?.items)) {
        raw = data.items
      } else if (Array.isArray(data?.rows)) {
        raw = data.rows
      } else {
        console.warn('[fetchProducts] respuesta no contiene array en content/items/rows', data)
        raw = []
      }

      // Normalizar usando exclusivamente los stockResponses que vienen inline en cada producto
      const normalized = raw.map(item => {
        // if endpoint returns wrapper { product, stockResponses } handle it
        const p = item.product ?? item

        const idRaw = p.id ?? p._id ?? p.uuid ?? null

        const name = p.name ?? p.title ?? 'Sin nombre'
        const salePrice = p.salePrice ?? p.price ?? p.sale_price ?? null
        const categoryNameFromProduct = p.categoryName ?? null

        // stockResponses must come from the product payload only
        const inlineStockResponses = Array.isArray(item.stockResponses)
          ? item.stockResponses
          : Array.isArray(p.stockResponses)
            ? p.stockResponses
            : (Array.isArray(p.stocks) ? p.stocks : [])

        const stockCount = Array.isArray(inlineStockResponses) ? inlineStockResponses.length : 0

        return {
          id: idRaw,
          providerId: p.providerId ?? p.provider?.id ?? null,
          providerName: p.providerName ?? p.provider?.username ?? p.provider?.name ?? null,
          categoryId: p.categoryId ?? p.category_id ?? null,
          categoryName: categoryNameFromProduct,
          name: name,
          terms: p.terms ?? null,
          productDetail: p.productDetail ?? p.product_detail ?? p.detail ?? null,
          requestDetail: p.requestDetail ?? p.request_detail ?? null,
          days: p.days ?? null,
          salePrice: salePrice,
          renewalPrice: p.renewalPrice ?? p.renewal_price ?? null,
          isRenewable: p.isRenewable ?? p.is_renewable ?? null,
          isOnRequest: p.isOnRequest ?? p.is_on_request ?? null,
          active: typeof p.active !== 'undefined' ? p.active : (p.isActive ?? true),
          createdAt: p.createdAt ?? p.created_at ?? null,
          updatedAt: p.updatedAt ?? p.updated_at ?? null,
          imageUrl: p.imageUrl ?? p.image ?? p.thumbnail ?? null,
          publishStart: p.publishStart ?? p.publish_start ?? null,
          publishEnd: p.publishEnd ?? p.publish_end ?? null,
          daysRemaining: p.daysRemaining ?? p.days_remaining ?? null,
          stockResponses: inlineStockResponses,
          stock: stockCount
        }
      })

      console.debug('[fetchProducts] normalized count =>', normalized.length)
      setProducts(normalized)
    } catch (err) {
      console.error('Error cargando productos:', err)
      setProdError('No se pudieron cargar los productos')
      setProducts([])
    } finally {
      setProdLoading(false)
    }
  }

  // navegar / seleccionar categoría (acepta objeto o id)
  const goToCategory = (catOrId) => {
    if (!catOrId) {
      setSelectedCategory(null)
      return
    }

    const id = (typeof catOrId === 'object') ? (catOrId.id ?? catOrId._id ?? null) : catOrId

    console.debug('[goToCategory] selected id =>', id)
    setSelectedCategory(id)
  }

  // --- Carrusel circular drag handlers (unchanged) ---
  useEffect(() => {
    const el = stripRef.current
    if (!el) return

    const checkOverflow = () => {
      const overflow = el.scrollWidth > el.clientWidth + 1
      setHasOverflow(overflow)
      return overflow
    }

    let attached = false

    const attachIfNeeded = () => {
      const overflow = checkOverflow()
      if (!overflow && attached) {
        detach()
        return
      }
      if (overflow && !attached) attach()
    }

    const attach = () => {
      if (attached) return
      attached = true

      const onPointerDown = (e) => {
        if (!checkOverflow()) return
        isDragging.current = true
        dragStartX.current = e.clientX ?? (e.touches && e.touches[0]?.clientX)
        scrollStartX.current = el.scrollLeft
        el.classList.add('is-dragging')
      }

      const onPointerMove = (e) => {
        if (!isDragging.current) return
        const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX)
        const dx = dragStartX.current - clientX
        el.scrollLeft = scrollStartX.current + dx
      }

      const onPointerUp = () => {
        if (!isDragging.current) return
        isDragging.current = false
        el.classList.remove('is-dragging')
      }

      const onWheel = (e) => {
        if (!checkOverflow()) return
        if (Math.abs(e.deltaX) > 0 || e.shiftKey) return
        if (Math.abs(e.deltaY) > 0) {
          e.preventDefault()
          el.scrollLeft += e.deltaY
        }
      }

      el.addEventListener('mousedown', onPointerDown)
      window.addEventListener('mousemove', onPointerMove)
      window.addEventListener('mouseup', onPointerUp)

      el.addEventListener('touchstart', onPointerDown, { passive: true })
      el.addEventListener('touchmove', onPointerMove, { passive: false })
      el.addEventListener('touchend', onPointerUp)

      el.addEventListener('wheel', onWheel, { passive: false })

      el._cleanup = () => {
        el.removeEventListener('mousedown', onPointerDown)
        window.removeEventListener('mousemove', onPointerMove)
        window.removeEventListener('mouseup', onPointerUp)
        el.removeEventListener('touchstart', onPointerDown)
        el.removeEventListener('touchmove', onPointerMove)
        el.removeEventListener('touchend', onPointerUp)
        el.removeEventListener('wheel', onWheel)
      }
    }

    const detach = () => {
      if (!attached) return
      attached = false
      if (el._cleanup) el._cleanup()
      el.classList.remove('is-dragging')
    }

    attachIfNeeded()
    const ro = new ResizeObserver(attachIfNeeded)
    ro.observe(el)
    window.addEventListener('resize', attachIfNeeded)

    return () => {
      ro.disconnect()
      detach()
      window.removeEventListener('resize', attachIfNeeded)
    }
  }, [categories])

  const scrollByOffset = (dir = 1) => {
    const el = stripRef.current
    if (!el) return
    const offset = Math.round(el.clientWidth * 0.5) * dir
    el.scrollBy({ left: offset, behavior: 'smooth' })
  }

  const moneyFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const formatPrice = (valueInCentavos) => {
    if (valueInCentavos === null || valueInCentavos === undefined) return '—'
    const value = Number(valueInCentavos) / 100
    if (Number.isNaN(value)) return '—'
    return moneyFormatter.format(value)
  }

  return (
    <>
      <Head>
        <title>Luna Streaming</title>
        <link rel="icon" href="/logofavicon.ico" type="image/x-icon" />
        <meta name="description" content="Luna Streaming - Visuales ritualizados y experiencias simbólicas" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap" rel="stylesheet" />
      </Head>

      <Navbar />
      <Carrusel />

      <main className="page-root">
        <section className="hero">
          <h1 className="hero-title">Explora nuestras categorías</h1>
          <p className="hero-sub">Disfruta del mejor contenido digital. Selecciona una categoría para descubrir contenidos.</p>
        </section>

        <section className="categories-section">
          <div className="section-header">
            <h2>Categorías</h2>
            <p className="muted">{catLoading ? 'Cargando...' : (catError ? catError : `${categories.length} disponibles`)}</p>
          </div>

          <div className="circle-strip-wrapper" aria-hidden={catLoading}>
            {catLoading ? (
              <div className="circle-strip skeleton-strip">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div className="circle-item skeleton" key={`skc-${i}`} />
                ))}
              </div>
            ) : (
              <div className="circle-strip-outer">
                <div className="fade left" style={{ display: hasOverflow ? 'block' : 'none' }} />
                <div className="circle-strip" ref={stripRef} role="list" tabIndex={0}>
                  <div className="circle-item-wrap" role="listitem">
                    <button
                      key="circle-all"
                      className={`circle-item ${selectedCategory === null ? 'active-cat' : ''}`}
                      onClick={() => goToCategory(null)}
                      title="Ver todos los productos"
                      aria-label="Ver todos los productos"
                      aria-pressed={selectedCategory === null}
                    >
                      <div className="circle-fallback">ALL</div>
                    </button>
                    <span className="circle-name">Todos</span>
                  </div>

                  {categories.map(cat => (
                    <div className="circle-item-wrap" role="listitem" key={`wrap-${cat.id}`}>
                      <button
                        key={`circle-${cat.id}`}
                        className={`circle-item ${selectedCategory === cat.id ? 'active-cat' : ''}`}
                        onClick={() => goToCategory(cat)}
                        title={cat.name}
                        aria-label={`Abrir ${cat.name}`}
                        aria-pressed={selectedCategory === cat.id}
                      >
                        {cat.image ? (
                          <img src={cat.image} alt={cat.name} loading="lazy" />
                        ) : (
                          <div className="circle-fallback">{(cat.name || '').slice(0,2).toUpperCase()}</div>
                        )}
                      </button>
                      <span className="circle-name">{cat.name}</span>
                    </div>
                  ))}
                </div>
                <div className="fade right" style={{ display: hasOverflow ? 'block' : 'none' }} />
                <button
                  className="subtle-arrow left"
                  onClick={() => scrollByOffset(-1)}
                  aria-hidden={!hasOverflow}
                  style={{ display: hasOverflow ? 'flex' : 'none' }}
                >
                  ‹
                </button>
                <button
                  className="subtle-arrow right"
                  onClick={() => scrollByOffset(1)}
                  aria-hidden={!hasOverflow}
                  style={{ display: hasOverflow ? 'flex' : 'none' }}
                >
                  ›
                </button>
              </div>
            )}
          </div>

          <div className="products-section">
            <div className="products-header">
              <h3>{selectedCategory ? `Productos en la categoría` : 'Todos los productos activos'}</h3>
              <p className="muted">{prodLoading ? 'Cargando productos...' : (prodError ? prodError : `${products.length} resultados`)}</p>
            </div>

            <div className="cards-grid">
              {prodLoading && Array.from({ length: 8 }).map((_, i) => (
                <article className="product-card skeleton" key={`psk-${i}`} />
              ))}

              {!prodLoading && products.length === 0 && !prodError && (
                <div className="empty">No hay productos activos.</div>
              )}

              {!prodLoading && products.map(p => {
                const stockCount = Number(p.stock ?? 0)
                const hasStock = stockCount > 0

                // find category name for centered banner (use categoryName from product first)
                const categoryName = p.categoryName ?? categories.find(c => String(c.id) === String(p.categoryId))?.name ?? 'Sin categoría'

                return (
                  <article className="product-card" key={p.id}>
                    {/* Category banner (centred) */}
                    <div className={`stock-bar stock-cat ${hasStock ? 'stock-available' : 'stock-empty'}`}>
                      <div className="stock-cat-name">{categoryName}</div>
                    </div>

                    <div className="product-media">
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt={p.name} loading="lazy" />
                      ) : (
                        <div className="product-media placeholder" />
                      )}
                    </div>

                    <div className="product-body">
                      <div className="product-title marquee" title={p.name}>
                        <span>{p.name}</span>
                      </div>

                      {/* provider name (centered) */}
                      {p.providerName && (
                        <div className="provider-name" title={p.providerName}>
                          {p.providerName}
                        </div>
                      )}

                      {/* price badge above actions */}
                      <div className="price-badge">{formatPrice(p.salePrice)}</div>

                      <div className="product-actions">
                        {hasStock ? (
                          <>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                              <button
                                className={`btn-primary in-stock`}
                                onClick={() => { window.location.href = `/products/${p.id}` }}
                                aria-disabled="false"
                              >
                                <span className="btn-text">Comprar</span>
                              </button>

                              {/* stock pill to the right of the button */}
                              <div className="stock-pill" aria-hidden>
                                <span className="stock-icon">📦</span>
                                <span className="stock-count-pill">{stockCount}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          // disabled red button when no stock (centered, full width)
                          <button
                            className="btn-primary out-stock disabled-sin-stock"
                            aria-disabled="true"
                            onClick={() => {}}
                          >
                            SIN STOCK
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      </main>

      {imagenActiva && (
        <div onClick={cerrarVistaAmpliada} className="modal">
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <img
              ref={mediaRef}
              src={imagenActiva}
              alt="Imagen"
              className={`modal-media ${zoomActivo ? 'modal-media--zoom' : ''}`}
              style={{ transformOrigin: `${zoomOrigin.x} ${zoomOrigin.y}` }}
              onClick={aplicarZoomFocalizado}
            />
            <div className="modal-text">Toca para ampliar</div>
          </div>
        </div>
      )}

      <Footer />
      <style jsx>{`
        :root{
          --bg-surface: rgba(255,255,255,0.02);
          --bg-surface-strong: rgba(255,255,255,0.04);
          --muted: #bfbfbf;
          --accent-1: #06b6d4;
          --accent-2: #6b46c1;
          --accent-contrast: #021018;
          --glass-blur: 8px;
          --shadow-subtle: 0 12px 30px rgba(2,6,23,0.45);
          --green-stock: #31C950;
          --green-stock-bg: rgba(49,201,80,0.08);
          --red-stock: #EF4444;
          --red-stock-bg: rgba(239,68,68,0.08);
          --blue-buy: #0677f5;
          --red-buy: #ef4444;
        }

        .page-root { background-color: #0D0D0D; color: #D1D1D1; min-height: 100vh; }

        .hero { max-width: 1200px; margin: 36px auto 12px; padding: 20px 28px; border-radius: 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          display: flex; flex-direction: column; gap: 8px; box-shadow: 0 8px 30px rgba(0,0,0,0.5); }
        .hero-title { margin: 0; font-size: 1.8rem; font-weight: 800; font-family: 'Poppins', Inter, sans-serif; }
        .hero-sub { margin: 0; color: #bfbfbf; font-family: Inter, sans-serif; }

        .categories-section { max-width: 1200px; margin: 20px auto 80px; padding: 18px 20px; border-radius: 14px; }
        .section-header { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 12px; }
        .muted { color: var(--muted); font-size: 0.95rem; }

        /* strip and circle styles (unchanged) ... */
        .circle-strip-wrapper { margin-bottom: 18px; position: relative; background: linear-gradient(180deg, rgba(255,255,255,0.01), rgba(255,255,255,0.005)); border-radius: 14px; padding: 10px 12px; box-shadow: var(--shadow-subtle); overflow: visible; }
        .circle-strip-outer { position: relative; display: flex; align-items: center; gap: 8px; }
        .circle-strip { display: flex; gap: 16px; overflow-x: auto; overflow-y: visible; padding: 8px 6px 48px; -webkit-overflow-scrolling: touch; scroll-behavior: smooth; align-items: center; width: 100%; scroll-snap-type: x proximity; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent; }
        .circle-item-wrap { flex: 0 0 auto; width: 120px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; margin-bottom: 0; scroll-snap-align: center; box-sizing: border-box; background: transparent; }
        .circle-item { width: 120px; height: 120px; border-radius: 999px; background: linear-gradient(180deg, var(--bg-surface), var(--bg-surface-strong)); border: 1px solid rgba(255,255,255,0.04); display: inline-flex; align-items: center; justify-content: center; position: relative; cursor: pointer; transition: transform 240ms cubic-bezier(.2,.9,.3,1), box-shadow 240ms ease; padding: 6px; overflow: visible; -webkit-tap-highlight-color: transparent; }
        .circle-item img { width: 100%; height: 100%; object-fit: cover; border-radius: 999px; display: block; transition: transform 240ms ease; }
        .circle-fallback { width: 100%; height: 100%; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #fff; background: linear-gradient(90deg, var(--accent-2), var(--accent-1)); box-shadow: 0 6px 18px rgba(6,27,48,0.35); }
        .circle-name { display: block; font-family: 'Poppins', Inter, sans-serif; font-weight: 600; font-size: 0.92rem; color: var(--muted); text-align: center; width: 160px; line-height: 1.1; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: none; z-index: 50; }
        .circle-item:hover, .circle-item:focus { transform: translateY(-6px) scale(1.03); box-shadow: 0 22px 48px rgba(6,20,40,0.5); }
        .circle-item.active-cat { transform: translateY(-6px) scale(1.03); box-shadow: 0 18px 40px rgba(6,20,40,0.45); border: 1px solid rgba(255,255,255,0.08); }
        .fade { position: absolute; top: 8px; bottom: 18px; width: 48px; pointer-events: none; z-index: 2; border-radius: 8px; }
        .fade.left { left: 6px; background: linear-gradient(90deg, rgba(13,13,13,0.95), rgba(13,13,13,0.0)); }
        .fade.right { right: 6px; background: linear-gradient(270deg, rgba(13,13,13,0.95), rgba(13,13,13,0.0)); }
        .subtle-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 999px; background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.85); display: inline-grid; place-items: center; border: 1px solid rgba(255,255,255,0.04); cursor: pointer; z-index: 3; transition: background 140ms ease, transform 140ms ease; font-size: 20px; line-height: 1; backdrop-filter: blur(var(--glass-blur)); }
        .subtle-arrow.left { left: 8px; } .subtle-arrow.right { right: 8px; } .subtle-arrow:hover { transform: translateY(-50%) scale(1.06); background: rgba(255,255,255,0.06); }

        /* products */
        .products-section { margin-top: 18px; }
        .products-header { display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:12px; }
        .cards-grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }

        .product-card {
          background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 12px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          transition: transform .18s ease, box-shadow .18s ease;
          position: relative;
        }
        .product-card:hover { transform: translateY(-6px); box-shadow: 0 18px 40px rgba(0,0,0,0.5); }
        .product-card.skeleton { min-height: 220px; background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.03)); animation: shimmer 1.2s linear infinite; }

        /* stock bar (top) */
        .stock-bar {
          display:flex;
          align-items:center;
          justify-content: space-between;
          gap: 8px;
          padding: 8px 12px;
          font-weight: 800;
          font-size: 0.86rem;
          text-transform: uppercase;
        }
        .stock-available {
          background: var(--green-stock-bg);
          color: var(--green-stock);
          border-bottom: 1px solid rgba(49,201,80,0.12);
        }
        .stock-empty {
          background: var(--red-stock-bg);
          color: var(--red-stock);
          border-bottom: 1px solid rgba(239,68,68,0.12);
        }
        .stock-text { flex:1; }
        .stock-qty { background: rgba(255,255,255,0.04); padding: 4px 8px; border-radius: 8px; color: inherit; font-weight: 900; }

        .product-media { width:100%; aspect-ratio: 4/3; background: #0b0b0b; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .product-media img { width:100%; height:100%; object-fit:cover; display:block; }
        .product-media.placeholder { background: linear-gradient(135deg,#1f2937,#111827); min-height: 140px; }
        .product-body { padding: 12px; display:flex; flex-direction:column; gap:8px; flex:1; }
        .product-title { font-weight:800; color:#fff; font-size:1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .product-price { color:#9ee7d9; font-weight:700; }
        .product-actions { margin-top:auto; display:flex; gap:8px; align-items:center; justify-content:center; }

        .provider-name {
          color: var(--muted);
          font-size: 0.88rem;
          margin-top: 6px;
          margin-bottom: 6px;
          font-weight: 600;
          text-overflow: ellipsis;
          white-space: nowrap;
          overflow: hidden;

          /* centrado */
          display: block;
          width: 100%;
          text-align: center;
        }

        .btn-primary { background: linear-gradient(90deg,#06b6d4,var(--green-stock)); color: var(--accent-contrast); border:none; padding:8px 10px; border-radius:8px; cursor:pointer; font-weight:700; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
        .btn-primary[aria-disabled="true"] { opacity: 0.95; cursor: not-allowed; }
        .btn-outline { background: transparent; border:1px solid rgba(255,255,255,0.06); color:#E6EEF7; padding:8px 10px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; font-weight:700; }

        /* new card-design styles (only these changed) */
        .stock-cat { display:flex; align-items:center; justify-content:center; padding:10px 16px; font-weight:900; font-size:0.95rem; text-transform:none; border-bottom: 1px solid rgba(255,255,255,0.04); background: linear-gradient(90deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01)); color: var(--muted); }
        .stock-cat-name { color: #E6EEF7; font-size:0.95rem; letter-spacing:0.02em; }

        .product-title.marquee { height: 26px; overflow: hidden; position: relative; }
        .product-title.marquee span { display: inline-block; padding-left: 100%; animation: marquee 8s linear infinite; white-space: nowrap; }
        @keyframes marquee { 0% { transform: translateX(0%); } 10% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }

        .price-badge { margin: 8px auto 0; background: rgba(0,0,0,0.35); padding:6px 10px; border-radius:999px; color:#9ee7d9; font-weight:800; border:1px solid rgba(255,255,255,0.04); }

        .btn-primary.in-stock { background: linear-gradient(90deg, var(--accent-1), #06b6d4); color: #fff; display:flex; align-items:center; gap:8px; }
        .btn-primary.out-stock { background: linear-gradient(90deg, rgba(255,240,240,0.02), rgba(255,240,240,0.01)); color: var(--red-stock); display:flex; align-items:center; gap:8px; border:1px solid rgba(239,68,68,0.08); }

        /* specific: ensure disabled out-stock button is red */
        .btn-primary.out-stock[aria-disabled="true"],
        .btn-primary.out-stock.disabled-sin-stock {
          background: linear-gradient(90deg, rgba(239,68,68,0.98), rgba(239,68,68,0.9));
          color: #fff;
          border: none;
          opacity: 1;
        }

        /* Stock pill (right of Comprar button) */
        .stock-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.04);
          color: var(--muted);
          font-weight: 800;
        }
        .stock-pill .stock-icon { font-size: 14px; }
        .stock-pill .stock-count-pill { font-weight: 900; color: #E6EEF7; }

        /* Disabled red SIN STOCK button (full) */
        .disabled-sin-stock {
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          font-weight: 900;
          letter-spacing: 0.02em;
        }

        .stock-icon { font-size:16px; }
        .stock-count { font-weight:900; }

        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .empty { color: var(--muted); padding: 20px; text-align: center; }

        /* modal */
        .modal { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0,0,0,0.7); backdrop-filter: blur(8px); display:flex; justify-content:center; align-items:center; z-index: 999; cursor: pointer; }
        .modal-media { max-width: 90vw; max-height: 90vh; border-radius: 20px; box-shadow: 0 12px 24px rgba(0,0,0,0.3); filter: drop-shadow(0 0 20px #BFBFBF); transition: transform 0.4s ease; cursor: zoom-in; }
        .modal-media--zoom { transform: scale(3); cursor: zoom-out; }
        .modal-text { position: absolute; bottom: -60px; width: 100%; text-align: center; color: #D1D1D1; font-size: 1.2rem; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }

        /* responsive */
        @media (max-width: 1100px) { .cards-grid { grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); } }
        @media (max-width: 820px) {
          .cards-grid { grid-template-columns: repeat(auto-fill, minmax(160px,1fr)); }
          .circle-item { width:100px; height:100px; }
          .circle-item-wrap { width:100px; }
          .circle-name { bottom: -28px; width: 140px; font-size: 0.86rem; white-space: nowrap; }
        }
        @media (max-width: 520px) {
          .cards-grid { grid-template-columns: 1fr; }
          .circle-item { width:84px; height:84px; }
          .circle-item-wrap { width:84px; }
          .circle-name {
            bottom: -26px;
            width:120px;
            font-size:0.76rem;
            white-space: normal;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .fade { display:none; }
          .subtle-arrow { display:none; }
          .product-actions { flex-direction: column; gap: 8px; align-items: stretch; }
          .stock-pill { justify-content: center; }
          .provider-name { font-size: 0.9rem; }
        }
      `}</style>

      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&display=swap');

        body { background-color: #0D0D0D; margin: 0; padding: 0; font-family: 'Inter', sans-serif; color: #D1D1D; }
        .circle-name, .hero-title { font-family: 'Poppins', Inter, sans-serif; }
        html { box-sizing: border-box; } *, *:before, *:after { box-sizing: inherit; }
      `}</style>
    </>
  )
}