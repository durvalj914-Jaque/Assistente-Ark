/**
 * /catalog/[tenantId] — Vitrine pública de produtos
 * Qualquer pessoa pode acessar, ver os produtos ativos e comprar (PIX, MP ou WhatsApp).
 */
import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function CatalogStore() {
  const router = useRouter()
  const { tenantId } = router.query

  const [store, setStore] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [buying, setBuying] = useState(null) // produto sendo comprado
  const [checkout, setCheckout] = useState(null) // resultado do buy (PIX/MP/WA)
  const [cart, setCart] = useState([]) // carrinho

  useEffect(() => {
    if (!tenantId) return
    loadCatalog()
  }, [tenantId])

  async function loadCatalog() {
    setLoading(true)
    try {
      const r = await fetch(`/api/catalog/products?tenant=${tenantId}`)
      if (!r.ok) {
        const e = await r.json()
        setError(e.error || 'Erro ao carregar')
        return
      }
      const d = await r.json()
      setStore(d.store)
      setProducts(d.products)
    } catch (e) {
      setError('Falha ao conectar')
    }
    setLoading(false)
  }

  async function handleBuy(product, method) {
    setBuying(product.id)
    setCheckout(null)
    try {
      const r = await fetch('/api/catalog/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          productId: product.id,
          method,
        }),
      })
      const d = await r.json()
      if (!r.ok) {
        alert(d.error || 'Erro ao processar compra')
        return
      }
      setCheckout(d)
    } catch (e) {
      alert('Falha ao conectar')
    }
    setBuying(null)
  }

  if (loading) return (
    <div style={s.loading}>
      <div style={s.spinner} />
      <p style={{ marginTop: 16, color: '#64748b' }}>Carregando vitrine…</p>
    </div>
  )

  if (error) return (
    <div style={s.loading}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>😕</div>
      <h2 style={{ color: '#fff', fontWeight: 700 }}>{error}</h2>
      <p style={{ color: '#64748b', marginTop: 8 }}>Verifique o link e tente novamente.</p>
    </div>
  )

  return (
    <>
      <Head>
        <title>{store?.name || 'Catálogo'} — Arkiel</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/assistente-ark-icon.png" />
      </Head>

      <div style={s.page}>
        {/* Header da loja */}
        <header style={s.header}>
          <div style={s.headerContent}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="/assistente-ark-icon.png" alt="Arkiel" style={{ width: 36, height: 36, objectFit: 'contain' }} />
              <div>
                <h1 style={s.storeName}>{store?.name || 'Loja'}</h1>
                <p style={s.storeSub}>{products.length} {products.length === 1 ? 'produto disponível' : 'produtos disponíveis'}</p>
              </div>
            </div>
            {store?.whatsappNumber && (
              <a href={`https://wa.me/${store.whatsappNumber}`} target="_blank" rel="noreferrer" style={s.waBtn}>
                <span>💬</span> Falar no WhatsApp
              </a>
            )}
          </div>
        </header>

        {/* Produtos */}
        <div style={s.grid}>
          {products.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <h3 style={{ color: '#e2e8f0', fontWeight: 600 }}>Nenhum produto disponível</h3>
              <p style={{ color: '#64748b', marginTop: 8 }}>Esta loja ainda não adicionou produtos. Volote em breve!</p>
            </div>
          ) : (
            products.map(p => (
              <div key={p.id} style={s.card}>
                {/* Imagem */}
                <div style={s.cardImage}>
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.name} style={s.img}
                      onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                  ) : null}
                  <div style={{ ...s.imgPlaceholder, display: p.image_url ? 'none' : 'flex' }}>📦</div>
                </div>

                {/* Info */}
                <div style={s.cardBody}>
                  {p.category && <span style={s.category}>{p.category}</span>}
                  <h3 style={s.productName}>{p.name}</h3>
                  {p.description && <p style={s.productDesc}>{p.description}</p>}

                  <div style={s.priceRow}>
                    <span style={s.price}>
                      {Number(p.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    {p.stock !== null && p.stock !== undefined && p.stock > 0 && (
                      <span style={s.stock}>{p.stock} em estoque</span>
                    )}
                  </div>

                  {/* Botões de compra */}
                  <div style={s.buyRow}>
                    {store?.pixKey && (
                      <button
                        onClick={() => handleBuy(p, 'pix')}
                        disabled={buying === p.id}
                        style={s.buyBtnPix}
                      >
                        {buying === p.id ? '⏳' : 'PIX'}
                      </button>
                    )}
                    <button
                      onClick={() => handleBuy(p, 'mercadopago')}
                      disabled={buying === p.id}
                      style={s.buyBtnMP}
                    >
                      {buying === p.id ? '⏳' : '💳 Cartão'}
                    </button>
                    {store?.whatsappNumber && (
                      <button
                        onClick={() => handleBuy(p, 'whatsapp')}
                        disabled={buying === p.id}
                        style={s.buyBtnWA}
                      >
                        {buying === p.id ? '⏳' : '💬'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <footer style={s.footer}>
          <p>🔒 Pagamento seguro · Powered by <strong>Arkiel</strong></p>
        </footer>
      </div>

      {/* Modal de checkout (PIX) */}
      {checkout?.method === 'pix' && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setCheckout(null)}>
          <div style={s.modalBox}>
            <button onClick={() => setCheckout(null)} style={s.modalClose}>✕</button>
            <h2 style={s.modalTitle}>💰 Pagamento PIX</h2>
            <p style={s.modalProduct}>{checkout.productName}</p>
            <p style={s.modalAmount}>R$ {checkout.amount.toFixed(2)}</p>
            <div style={s.qrBox}>
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(checkout.pixCode)}`}
                alt="QR Code PIX" style={{ width: 240, height: 240, borderRadius: 12 }} />
            </div>
            <div style={s.pixCopyBox}>
              <p style={s.pixCopyLabel}>Copia e cola:</p>
              <div style={s.pixCopyCode} onClick={() => { navigator.clipboard?.writeText(checkout.pixCode); }}>
                {checkout.pixCode.substring(0, 50)}…
              </div>
              <button onClick={() => navigator.clipboard?.writeText(checkout.pixCode)} style={s.copyBtn}>
                📋 Copiar código
              </button>
            </div>
            <p style={s.modalFooter}>Após o pagamento, seu pedido será confirmado automaticamente.</p>
          </div>
        </div>
      )}

      {/* Modal de checkout (Mercado Pago) */}
      {checkout?.method === 'mercadopago' && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setCheckout(null)}>
          <div style={s.modalBox}>
            <button onClick={() => setCheckout(null)} style={s.modalClose}>✕</button>
            <h2 style={s.modalTitle}>💳 Pagamento Seguro</h2>
            <p style={s.modalProduct}>{checkout.productName}</p>
            <p style={s.modalAmount}>R$ {checkout.amount?.toFixed(2)}</p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
              Você será redirecionado para o checkout seguro do Mercado Pago. Aceita PIX, cartão e boleto.
            </p>
            <a href={checkout.checkoutUrl} target="_blank" rel="noreferrer" style={s.mpLink}>
              Ir para pagamento →
            </a>
          </div>
        </div>
      )}

      {/* Redirect WhatsApp */}
      {checkout?.method === 'whatsapp' && checkout.whatsappLink && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setCheckout(null)}>
          <div style={s.modalBox}>
            <button onClick={() => setCheckout(null)} style={s.modalClose}>✕</button>
            <h2 style={s.modalTitle}>💬 Comprar via WhatsApp</h2>
            <p style={s.modalProduct}>{checkout.productName}</p>
            <p style={s.modalAmount}>R$ {checkout.amount.toFixed(2)}</p>
            <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 20, textAlign: 'center' }}>
              Você será redirecionado para o WhatsApp para finalizar sua compra com nossos atendentes.
            </p>
            <a href={checkout.whatsappLink} target="_blank" rel="noreferrer" style={s.waLink}>
              Abrir WhatsApp →
            </a>
          </div>
        </div>
      )}
    </>
  )
}

const s = {
  loading: { minHeight: '100vh', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 32, height: 32, border: '3px solid rgba(79,142,247,0.2)', borderTopColor: '#4f8ef7', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  page: { minHeight: '100vh', background: '#000', color: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif' },
  header: { background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '20px 0', position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' },
  headerContent: { maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 },
  storeName: { fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.5 },
  storeSub: { fontSize: 12, color: '#64748b', marginTop: 2 },
  waBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', color: '#25d366', padding: '9px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' },
  grid: { maxWidth: 1200, margin: '0 auto', padding: '32px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 },
  empty: { gridColumn: '1/-1', textAlign: 'center', padding: '60px 40px' },
  card: { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden', transition: 'transform 0.2s, border-color 0.2s', ':hover': {} },
  cardImage: { width: '100%', height: 200, background: 'rgba(255,255,255,0.03)', overflow: 'hidden', position: 'relative' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  imgPlaceholder: { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48 },
  cardBody: { padding: 20 },
  category: { display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: '#4f8ef7', background: 'rgba(79,142,247,0.1)', padding: '3px 8px', borderRadius: 100, marginBottom: 10 },
  productName: { fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6, lineHeight: 1.3 },
  productDesc: { fontSize: 13, color: '#64748b', lineHeight: 1.5, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  priceRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  price: { fontSize: 22, fontWeight: 800, color: '#10b981' },
  stock: { fontSize: 11, color: '#475569' },
  buyRow: { display: 'flex', gap: 8 },
  buyBtnPix: { flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', transition: 'opacity 0.15s' },
  buyBtnMP: { flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', transition: 'opacity 0.15s' },
  buyBtnWA: { padding: '11px 14px', borderRadius: 10, fontSize: 13, fontWeight: 700, border: '1px solid rgba(37,211,102,0.25)', cursor: 'pointer', background: 'rgba(37,211,102,0.12)', color: '#25d366', transition: 'opacity 0.15s' },
  footer: { textAlign: 'center', padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#475569', fontSize: 12 },
  // Modal
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalBox: { background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 20, padding: 32, maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative' },
  modalClose: { position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 },
  modalTitle: { fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 8 },
  modalProduct: { fontSize: 14, color: '#94a3b8', marginBottom: 4 },
  modalAmount: { fontSize: 28, fontWeight: 800, color: '#10b981', marginBottom: 24 },
  qrBox: { display: 'flex', justifyContent: 'center', marginBottom: 20 },
  pixCopyBox: { background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 16, marginBottom: 16 },
  pixCopyLabel: { fontSize: 11, fontWeight: 700, letterSpacing: 1, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 },
  pixCopyCode: { fontSize: 11, color: '#475569', fontFamily: 'monospace', wordBreak: 'break-all', cursor: 'pointer', marginBottom: 10 },
  copyBtn: { background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.2)', color: '#4f8ef7', padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  modalFooter: { fontSize: 12, color: '#475569', marginTop: 8 },
  mpLink: { display: 'block', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', color: '#fff', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none' },
  waLink: { display: 'block', background: '#25d366', color: '#fff', padding: '14px 0', borderRadius: 12, fontSize: 15, fontWeight: 700, textAlign: 'center', textDecoration: 'none' },
}
