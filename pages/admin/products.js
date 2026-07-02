import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

function ProductModal({ product, onClose, onSave }) {
  const [form, setForm] = useState({
    name:        product?.name || '',
    description: product?.description || '',
    price:       product?.price ?? '',
    image_url:   product?.image_url || '',
    category:    product?.category || '',
    sku:         product?.sku || '',
    stock:       product?.stock ?? '',
    is_active:   product?.is_active ?? true,
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.name.trim()) return
    setSaving(true)
    await onSave({
      ...form,
      price: form.price === '' ? 0 : parseFloat(form.price),
      stock: form.stock === '' ? null : parseInt(form.stock, 10),
    })
    setSaving(false)
  }

  const Field = ({ label, name, placeholder, type = 'text', hint, textarea }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }}>{label}</label>
      {textarea ? (
        <textarea value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          placeholder={placeholder} className="ark-input" rows={3} style={{ resize: 'vertical' }} />
      ) : (
        <input type={type} value={form[name]} onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          placeholder={placeholder} className="ark-input" />
      )}
      {hint && <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>{hint}</p>}
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0d0d1a', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h2 style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{product ? 'Editar Produto' : 'Novo Produto'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>

        <Field label="NOME DO PRODUTO" name="name" placeholder="Ex: Plano Pro Mensal" />
        <Field label="DESCRIÇÃO" name="description" placeholder="Detalhes do produto/serviço" textarea />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="PREÇO (R$)" name="price" type="number" placeholder="97.00" />
          <Field label="ESTOQUE" name="stock" type="number" placeholder="(vazio = ilimitado)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="CATEGORIA" name="category" placeholder="Ex: Assinaturas" />
          <Field label="SKU" name="sku" placeholder="Código interno" />
        </div>

        <Field label="URL DA IMAGEM" name="image_url" placeholder="https://..." hint="Usada nas mensagens de catálogo do bot" />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 4 }}>
          <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
            style={{ width: 16, height: 16, accentColor: '#4f8ef7', cursor: 'pointer' }} />
          <label style={{ color: '#94a3b8', fontSize: 13, cursor: 'pointer' }} onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}>
            Produto ativo (visível no catálogo do bot)
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} className="ark-btn-ghost">Cancelar</button>
          <button onClick={handleSave} className="ark-btn" disabled={saving || !form.name.trim()}>
            {saving ? 'Salvando…' : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [products, setProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [editingProduct, setEditingProduct] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  useEffect(() => {
    if (!tenant) return
    loadProducts()
  }, [tenant])

  async function loadProducts() {
    setLoadingProducts(true)
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
    if (!error) setProducts(data || [])
    setLoadingProducts(false)
  }

  async function handleCreate() {
    setCreating(true)
    setEditingProduct(null)
    setShowModal(true)
    setCreating(false)
  }

  async function handleSave(form) {
    if (editingProduct) {
      const { data, error } = await supabase.from('products')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingProduct.id)
        .select().single()
      if (!error) {
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? data : p))
      }
    } else {
      const { data, error } = await supabase.from('products')
        .insert({ ...form, tenant_id: tenant.id })
        .select().single()
      if (!error) {
        setProducts(prev => [data, ...prev])
      }
    }
    setShowModal(false)
    setEditingProduct(null)
  }

  async function toggleActive(product) {
    const { data, error } = await supabase.from('products')
      .update({ is_active: !product.is_active, updated_at: new Date().toISOString() })
      .eq('id', product.id)
      .select().single()
    if (!error) setProducts(prev => prev.map(p => p.id === product.id ? data : p))
  }

  async function handleDelete(productId) {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return
    setDeleting(productId)
    await supabase.from('products').delete().eq('id', productId)
    setProducts(prev => prev.filter(p => p.id !== productId))
    setDeleting(null)
  }

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  const categories = ['all', ...new Set(products.map(p => p.category).filter(Boolean))]
  const filtered = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const activeCount = products.filter(p => p.is_active).length
  const totalValue = products.reduce((sum, p) => sum + (p.is_active ? Number(p.price || 0) : 0), 0)

  return (
    <>
      {showModal && (
        <ProductModal
          product={editingProduct}
          onClose={() => { setShowModal(false); setEditingProduct(null) }}
          onSave={handleSave}
        />
      )}

      <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>📦 Produtos</h1>
            <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>
              {products.length} produto{products.length !== 1 ? 's' : ''} · {activeCount} ativo{activeCount !== 1 ? 's' : ''} no catálogo
            </p>
          </div>
          <button onClick={handleCreate} className="ark-btn" disabled={creating}>
            {creating ? 'Criando…' : '+ Novo Produto'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
          <div className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22 }}>📦</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#4f8ef7' }}>{products.length}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>Produtos cadastrados</div>
          </div>
          <div className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22 }}>✅</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#10b981' }}>{activeCount}</div>
            <div style={{ fontSize: 12, color: '#475569' }}>Ativos no catálogo do bot</div>
          </div>
          <div className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 22 }}>💰</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#f59e0b' }}>
              {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
            <div style={{ fontSize: 12, color: '#475569' }}>Valor total (ativos)</div>
          </div>
        </div>

        {/* Filtros */}
        {products.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍 Buscar produto…"
              className="ark-input"
              style={{ maxWidth: 260 }}
            />
            {categories.length > 1 && (
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="ark-input" style={{ maxWidth: 200 }}>
                {categories.map(c => (
                  <option key={c} value={c}>{c === 'all' ? 'Todas as categorias' : c}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {loadingProducts ? (
          <div className="ark-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div className="ark-spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : products.length === 0 ? (
          <div className="ark-card" style={{ textAlign: 'center', padding: '60px 40px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
            <h3 style={{ color: '#e2e8f0', fontWeight: 600, marginBottom: 8 }}>Nenhum produto ainda</h3>
            <p style={{ color: '#475569', fontSize: 14, marginBottom: 24 }}>
              Cadastre produtos ou planos para exibi-los no catálogo do seu bot de WhatsApp
            </p>
            <button onClick={handleCreate} className="ark-btn">+ Criar primeiro produto</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ark-card" style={{ textAlign: 'center', padding: '40px' }}>
            <p style={{ color: '#475569', fontSize: 14 }}>Nenhum produto encontrado com esse filtro.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filtered.map(product => (
              <div key={product.id} className="ark-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name}
                        style={{ width: 40, height: 40, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>📦</div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{product.category || 'Sem categoria'}</div>
                    </div>
                  </div>
                  <span className={`ark-badge ${product.is_active ? 'ark-badge-green' : 'ark-badge-gray'}`}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
                    {product.is_active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>

                {product.description && (
                  <p style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {product.description}
                  </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#12121f', borderRadius: 8, padding: '10px 12px' }}>
                  <div>
                    <div style={{ color: '#10b981', fontWeight: 800, fontSize: 16 }}>
                      {Number(product.price || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                    {product.stock !== null && product.stock !== undefined && (
                      <div style={{ color: '#475569', fontSize: 11 }}>{product.stock} em estoque</div>
                    )}
                  </div>
                  {product.sku && <div style={{ color: '#334155', fontSize: 10 }}>SKU: {product.sku}</div>}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => { setEditingProduct(product); setShowModal(true) }} className="ark-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 0' }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => toggleActive(product)} className="ark-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '7px 0' }}>
                    {product.is_active ? '⏸ Pausar' : '▶ Ativar'}
                  </button>
                  <button onClick={() => handleDelete(product.id)} disabled={deleting === product.id} className="ark-btn-danger" style={{ padding: '7px 10px', fontSize: 12 }}>
                    {deleting === product.id ? '…' : '🗑'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminLayout>
    </>
  )
}
