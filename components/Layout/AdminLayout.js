import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: '⬡', exact: true },
  { href: '/admin/bots', label: 'Bots', icon: '🤖' },
  { href: '/admin/flow', label: 'Editor de Fluxo', icon: '⚡' },
  { href: '/admin/contacts', label: 'Contatos', icon: '👥' },
  { href: '/admin/conversations', label: 'Conversas', icon: '💬' },
  { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
  { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
]

export default function AdminLayout({ children, tenant, user, role }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const plan = PLANS[tenant?.plan] || PLANS.free

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const sideW = collapsed ? 64 : 240

  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Logo */}
      <div style={{ padding: collapsed ? '18px 0' : '20px 18px', borderBottom: '1px solid rgba(79,142,247,0.08)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🤖</div>
              <span style={{ fontWeight: 800, fontSize: 14, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Assistente Ark</span>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🤖</div>
        )}
        <button onClick={() => setCollapsed(c => !c)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#334155', fontSize: 14, padding: 4, marginLeft: collapsed ? 0 : 0 }}>
          {collapsed ? '→' : '←'}
        </button>
      </div>

      {/* Tenant info */}
      {!collapsed && tenant && (
        <div style={{ padding: '10px 18px', borderBottom: '1px solid rgba(79,142,247,0.06)' }}>
          <div style={{ background: 'rgba(79,142,247,0.07)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tenant.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>{plan.label}</span>
              <span style={{ fontSize: 10, color: '#334155' }}>· {plan.max_bots === 999 ? '∞' : plan.max_bots} bot{plan.max_bots !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {NAV.map(item => {
          const active = item.exact
            ? router.pathname === item.href
            : router.pathname === item.href || router.pathname.startsWith(item.href + '/')
          return (
            <Link key={item.href} href={item.href}
              title={collapsed ? item.label : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '11px 0' : '10px 18px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'rgba(79,142,247,0.1)' : 'transparent',
                borderLeft: collapsed ? 'none' : (active ? '3px solid #4f8ef7' : '3px solid transparent'),
                borderRight: collapsed ? (active ? '3px solid #4f8ef7' : '3px solid transparent') : 'none',
                color: active ? '#4f8ef7' : '#64748b',
                textDecoration: 'none', fontSize: 13,
                fontWeight: active ? 600 : 400,
                transition: 'all 0.15s',
                position: 'relative',
              }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? '12px 0' : '12px 18px', borderTop: '1px solid rgba(79,142,247,0.08)' }}>
        {!collapsed && tenant?.plan === 'free' && (
          <Link href="/admin/upgrade" style={{
            display: 'block', textAlign: 'center', padding: '8px',
            background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)',
            borderRadius: 8, color: '#fff', textDecoration: 'none',
            fontSize: 12, fontWeight: 700, marginBottom: 10
          }}>⚡ Upgrade para Pro</Link>
        )}
        {!collapsed ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0, fontWeight: 700, color: '#fff' }}>
                {(user?.email || '?')[0].toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email?.split('@')[0]}</div>
                <div style={{ fontSize: 10, color: '#475569' }}>{role}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/client" style={{ flex: 1, textAlign: 'center', fontSize: 11, color: '#4f8ef7', textDecoration: 'none', padding: '5px 0', background: 'rgba(79,142,247,0.08)', borderRadius: 6 }}>Portal</Link>
              <button onClick={handleLogout} style={{ flex: 1, fontSize: 11, color: '#ef4444', background: 'rgba(239,68,68,0.08)', border: 'none', borderRadius: 6, cursor: 'pointer', padding: '5px 0' }}>Sair</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <button onClick={handleLogout} title="Sair" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16 }}>🚪</button>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#080810', fontFamily: 'Inter, sans-serif' }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div onClick={() => setMobileOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 19, display: 'none' }}
          className="mobile-overlay" />
      )}

      {/* Sidebar */}
      <aside style={{
        width: sideW,
        background: '#0a0a14',
        borderRight: '1px solid rgba(79,142,247,0.12)',
        position: 'fixed', top: 0, left: 0, height: '100vh',
        zIndex: 20,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}>
        <SidebarContent />
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: sideW,
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Top bar */}
        <div style={{
          height: 56, background: 'rgba(8,8,16,0.8)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(79,142,247,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ fontSize: 13, color: '#475569' }}>
            {NAV.find(n => n.exact ? router.pathname === n.href : router.pathname.startsWith(n.href))?.label || 'Painel'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
            <span style={{ fontSize: 12, color: '#10b981' }}>Sistema operacional</span>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
