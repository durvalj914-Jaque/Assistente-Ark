import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '🏠' },
  { href: '/admin/bots', label: 'Bots', icon: '🤖' },
  { href: '/admin/flow', label: 'Editor de Fluxo', icon: '🌿' },
  { href: '/admin/contacts', label: 'Contatos', icon: '👥' },
  { href: '/admin/conversations', label: 'Conversas', icon: '💬' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
]

export default function AdminLayout({ children, tenant, user, role }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const plan = PLANS[tenant?.plan] || PLANS.free

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080810', fontFamily: 'Inter, sans-serif' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, background: '#0a0a14',
        borderRight: '1px solid rgba(79,142,247,0.12)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, height: '100vh', zIndex: 10
      }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 18px', borderBottom: '1px solid rgba(79,142,247,0.08)' }}>
          <div style={{ fontSize: 17, fontWeight: 800, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Assistente Ark
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 2 }}>Painel Admin</div>
          {tenant && (
            <div style={{ marginTop: 10, background: 'rgba(79,142,247,0.08)', borderRadius: 8, padding: '6px 10px' }}>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</div>
              <div style={{ fontSize: 10, color: '#4f8ef7', marginTop: 2 }}>
                {plan.label} · {plan.max_bots === 999 ? '∞' : plan.max_bots} bot{plan.max_bots !== 1 ? 's' : ''}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = router.pathname === item.href || (item.href !== '/admin' && router.pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 20px',
                  background: active ? 'rgba(79,142,247,0.1)' : 'transparent',
                  borderLeft: active ? '3px solid #4f8ef7' : '3px solid transparent',
                  color: active ? '#4f8ef7' : '#64748b',
                  textDecoration: 'none', fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s'
                }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(79,142,247,0.08)' }}>
          {tenant?.plan === 'free' && (
            <Link href="/admin/upgrade" style={{
              display: 'block', textAlign: 'center', padding: '8px',
              background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)',
              borderRadius: 8, color: '#fff', textDecoration: 'none',
              fontSize: 12, fontWeight: 700, marginBottom: 10
            }}>⚡ Upgrade para Pro</Link>
          )}
          <div style={{ fontSize: 12, color: '#475569', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.email}
          </div>
          <Link href="/client" style={{ fontSize: 12, color: '#4f8ef7', textDecoration: 'none', display: 'block', marginBottom: 8 }}>
            👤 Portal do Cliente →
          </Link>
          <button onClick={handleLogout} style={{ fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, marginLeft: 240, minHeight: '100vh', padding: '32px 36px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
