import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabase'
import { PLANS } from '../../lib/plans'

/**
 * Layout estilo WhatsApp Web.
 * Top bar minimal com: ícone do bot (esquerda) + título da página + botões à direita.
 * Menu de três pontinhos abre dropdown com toda a navegação.
 */
export default function AdminLayout({ children, tenant, user, role, profile, hideTopBar }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [finOpen, setFinOpen] = useState(router.pathname === '/admin/financeiro')
  const menuRef = useRef(null)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fechar menu ao trocar de rota
  useEffect(() => { setMenuOpen(false) }, [router.pathname])

  const isPlatformAdmin = profile?.is_platform_admin

  const MENU_ITEMS = [
    { href: '/admin/conversations', label: 'Conversas', icon: '💬' },
    { href: '/admin/products', label: 'Catálogo', icon: '📦' },
    { href: '/admin/whatsapp-setup', label: 'Conectar WhatsApp', icon: '📱' },
    { href: '/admin/bots', label: 'Configurar Bot', icon: '🤖' },
    { href: '/admin/contacts', label: 'Contatos', icon: '👥' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { href: '/admin/financeiro', label: 'Financeiro', icon: '💰', expandable: true, children: [
      { href: '/admin/financeiro?tab=payment_methods', label: 'Formas de Pagamentos', icon: '💳' },
      { href: '/admin/financeiro?tab=billing_methods', label: 'Formas de Cobranças', icon: '📥' },
      { href: '/admin/financeiro?tab=receipts', label: 'Comprovantes', icon: '📄' },
    ]},
    { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
    { href: '/admin/api', label: 'API', icon: '🔌' },
  ]
  if (isPlatformAdmin) MENU_ITEMS.push({ href: '/painel', label: 'Painel Arkiel', icon: '⚡' })

  // Detectar página atual pra mostrar no título
  const currentItem = MENU_ITEMS.find(item =>
    item.href === '/admin/conversations'
      ? router.pathname === '/admin' || router.pathname === item.href || router.pathname.startsWith(item.href + '/')
      : router.pathname === item.href || router.pathname.startsWith(item.href + '/')
  )

  if (hideTopBar) {
    return <div className="ark-layout-main" style={{ height: '100dvh', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}><div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>{children}</div></div>
  }

  return (
    <div className="ark-layout-main" style={{ height: '100dvh', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar estilo WhatsApp */}
      <header className="ark-layout-topbar" style={{
        height: 60, background: 'var(--bg-topbar)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', paddingTop: 'env(safe-area-inset-top, 0px)',
        flexShrink: 0, position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Esquerda: ícone do bot + nome */}
        <Link href="/admin/conversations" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(79,142,247,0.15), rgba(6,182,212,0.1))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid var(--border-strong)',
          }}>
            <img src="/assistente-ark-icon.png" alt="Ark" style={{ width: 24, height: 24, borderRadius: 5, objectFit: 'contain' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontWeight: 800, fontSize: 14,
              background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>Assistente Ark</span>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              {tenant?.name || '...'}
            </span>
          </div>
        </Link>

        {/* Centro: título da página atual */}
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{currentItem?.icon || ''}</span>
          <span>{currentItem?.label || ''}</span>
        </div>

        {/* Direita: botão catálogo + três pontinhos */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Botão Catálogo */}
          <Link href="/admin/products" title="Catálogo de produtos"
            style={{
              width: 38, height: 38, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)',
              cursor: 'pointer', textDecoration: 'none', fontSize: 18,
              transition: 'background 0.2s',
            }}>
            📦
          </Link>

          {/* Menu três pontinhos */}
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(o => !o)} title="Menu"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: menuOpen ? 'var(--blue-tint)' : 'var(--bg-secondary)',
                border: menuOpen ? '1px solid var(--border-strong)' : '1px solid var(--border-soft)',
                cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)',
                transition: 'all 0.2s',
              }}>
              ⋮
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 46, right: 0,
                background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
                borderRadius: 12, padding: 6, minWidth: 220,
                boxShadow: '0 8px 32px rgba(0,0,0,0.3)', zIndex: 200,
              }}>
                {/* Info do usuário no topo do menu */}
                <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden' }}>
                      {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.email || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{role} · {PLANS[tenant?.plan]?.label || 'Free'}</div>
                    </div>
                  </div>
                </div>

                {/* Items de navegação */}
                {MENU_ITEMS.map(item => {
                  if (item.expandable) {
                    const isFinActive = router.pathname === '/admin/financeiro'
                    return (
                      <div key={item.href}>
                        <button onClick={() => setFinOpen(o => !o)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', padding: '9px 12px', borderRadius: 8, border: 'none',
                            background: isFinActive ? 'var(--blue-tint)' : 'transparent',
                            cursor: 'pointer', fontSize: 13,
                            color: isFinActive ? '#4f8ef7' : 'var(--text-secondary)',
                            fontWeight: isFinActive ? 600 : 400,
                            transition: 'background 0.1s',
                          }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16 }}>{item.icon}</span>
                            <span>{item.label}</span>
                          </span>
                          <span style={{ fontSize: 11, transition: 'transform 0.2s', transform: finOpen ? 'rotate(180deg)' : 'none' }}>▼</span>
                        </button>
                        {finOpen && item.children.map(child => (
                          <Link key={child.href} href={child.href}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '7px 12px 7px 36px', borderRadius: 8, textDecoration: 'none',
                              color: router.asPath === child.href ? '#4f8ef7' : 'var(--text-muted)',
                              background: router.asPath === child.href ? 'var(--blue-tint)' : 'transparent',
                              fontSize: 12, fontWeight: router.asPath === child.href ? 600 : 400,
                              transition: 'background 0.1s',
                            }}>
                            <span style={{ fontSize: 14 }}>{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    )
                  }
                  const active = router.pathname === item.href || router.pathname.startsWith(item.href + '/')
                  return (
                    <Link key={item.href} href={item.href}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 8, textDecoration: 'none',
                        color: active ? '#4f8ef7' : 'var(--text-secondary)',
                        background: active ? 'var(--blue-tint)' : 'transparent',
                        fontSize: 13, fontWeight: active ? 600 : 400,
                        transition: 'background 0.1s',
                      }}>
                      <span style={{ fontSize: 16 }}>{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  )
                })}

                {/* Separador + Sair */}
                <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 4, paddingTop: 4 }}>
                  <button onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '9px 12px', borderRadius: 8, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      color: '#ef4444', fontSize: 13, fontWeight: 500,
                    }}>
                    <span style={{ fontSize: 16 }}>🚪</span>
                    <span>Sair</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo da página */}
      <div className="ark-layout-content" style={{ 
        flex: 1, 
        overflowY: 'auto',
        padding: '24px 28px',
        minHeight: 0,
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </div>
    </div>
  )
}
