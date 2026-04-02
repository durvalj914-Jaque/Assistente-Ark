import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'

export default function ContactsPage() {
  const router = useRouter()
  const { user, tenant, role, loading } = useTenant()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [user, loading])
  useEffect(() => {
    if (!tenant) return
    supabase.from('contacts').select('*').eq('tenant_id', tenant.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setContacts(data || []))
  }, [tenant])

  const filtered = contacts.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  if (loading || !user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ color: '#fff', fontWeight: 800, fontSize: 20 }}>👥 Contatos</h1>
          <p style={{ color: '#475569', fontSize: 13, marginTop: 4 }}>{contacts.length} contatos cadastrados</p>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar…" className="ark-input" style={{ width: 220 }} />
      </div>

      <div className="ark-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(79,142,247,0.1)' }}>
              {['Nome', 'Telefone', 'E-mail', 'Tags', 'Status', 'Criado em'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: '#475569', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                <td style={{ padding: '12px 16px', color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>{c.name || '—'}</td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{c.phone}</td>
                <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: 13 }}>{c.email || '—'}</td>
                <td style={{ padding: '12px 16px' }}>
                  {(c.tags || []).map(tag => (
                    <span key={tag} style={{ fontSize: 10, background: 'rgba(79,142,247,0.1)', borderRadius: 4, padding: '2px 7px', color: '#4f8ef7', marginRight: 4 }}>{tag}</span>
                  ))}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, fontWeight: 700,
                    background: c.opt_in ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color: c.opt_in ? '#10b981' : '#ef4444' }}>
                    {c.opt_in ? '● Ativo' : '○ Optout'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', color: '#475569', fontSize: 12 }}>
                  {new Date(c.created_at).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#334155', fontSize: 14 }}>Nenhum contato encontrado</div>}
      </div>
    </AdminLayout>
  )
}
