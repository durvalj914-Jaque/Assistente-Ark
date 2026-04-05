import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

const STATUS_COLORS = { true: '#10b981', false: '#ef4444' }

export default function ContactsPage() {
  const router = useRouter()
  const { user, tenant, role, loading } = useTenant()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 50

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])

  const loadContacts = useCallback(async (reset = false) => {
    if (!tenant) return
    setLoadingContacts(true)
    const from = reset ? 0 : page * PAGE_SIZE
    const { data, count } = await supabase
      .from('contacts').select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (reset) setContacts(data || [])
    else setContacts(prev => [...prev, ...(data || [])])
    setHasMore((from + PAGE_SIZE) < (count || 0))
    setLoadingContacts(false)
  }, [tenant, page])

  useEffect(() => { loadContacts(true) }, [tenant])

  const filtered = search
    ? contacts.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : contacts

  async function toggleOptIn(contact) {
    const newVal = !contact.opt_in
    await supabase.from('contacts').update({ opt_in: newVal }).eq('id', contact.id)
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, opt_in: newVal } : c))
    if (selected?.id === contact.id) setSelected(c => ({ ...c, opt_in: newVal }))
  }

  async function updateTag(contactId, tags) {
    await supabase.from('contacts').update({ tags }).eq('id', contactId)
    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, tags } : c))
  }

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>👥 Contatos</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{contacts.length} contatos</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail…" className="ark-input" style={{ width: 280 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        {/* Tabela */}
        <div className="ark-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ark-table">
            <thead>
              <tr>
                {['Contato', 'Telefone', 'E-mail', 'Tags', 'Opt-in', 'Cadastro'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: '48px 0', color: '#334155' }}>
                  {search ? 'Nenhum resultado encontrado' : 'Nenhum contato ainda'}
                </td></tr>
              )}
              {filtered.map(c => (
                <tr key={c.id} onClick={() => setSelected(s => s?.id === c.id ? null : c)}
                  style={{ cursor: 'pointer', background: selected?.id === c.id ? 'rgba(79,142,247,0.07)' : undefined }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                        {(c.name || c.phone || '?')[0].toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.name || <span style={{ color: '#475569' }}>Sem nome</span>}</span>
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.phone}</td>
                  <td style={{ color: '#64748b' }}>{c.email || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(c.tags || []).slice(0, 2).map(tag => (
                        <span key={tag} className="ark-badge ark-badge-blue" style={{ fontSize: 10 }}>{tag}</span>
                      ))}
                      {(c.tags || []).length > 2 && <span className="ark-badge ark-badge-gray">+{c.tags.length - 2}</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`ark-badge ${c.opt_in ? 'ark-badge-green' : 'ark-badge-red'}`}>
                      {c.opt_in ? '✓ Ativo' : '✗ Inativo'}
                    </span>
                  </td>
                  <td style={{ color: '#475569', fontSize: 12 }}>
                    {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <button onClick={() => { setPage(p => p + 1); loadContacts() }} className="ark-btn-ghost" disabled={loadingContacts}>
                {loadingContacts ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>

        {/* Detalhe do contato */}
        {selected && (
          <div className="ark-card" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>Detalhes</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 8px' }}>
                  {(selected.name || selected.phone || '?')[0].toUpperCase()}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0' }}>{selected.name || 'Sem nome'}</div>
              </div>
              {[
                ['📱 Telefone', selected.phone],
                ['📧 E-mail',  selected.email || '—'],
                ['📅 Cadastro', new Date(selected.created_at).toLocaleDateString('pt-BR')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: '#475569' }}>{label}</span>
                  <span style={{ color: '#e2e8f0', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              <hr className="ark-divider" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: 13 }}>Opt-in</span>
                <button onClick={() => toggleOptIn(selected)}
                  className={`ark-badge ${selected.opt_in ? 'ark-badge-green' : 'ark-badge-red'}`}
                  style={{ border: 'none', cursor: 'pointer', padding: '5px 12px' }}>
                  {selected.opt_in ? '✓ Ativo' : '✗ Inativo'}
                </button>
              </div>
              <button onClick={() => router.push(`/admin/conversations?contact=${selected.id}`)}
                className="ark-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
                Ver conversas →
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
