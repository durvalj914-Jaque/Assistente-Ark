import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'

/**
 * Layout estilo WhatsApp Web.
 * Uma única barra de navegação, sempre visível e rolável na horizontal.
 * Nada escondido em menus: todas as seções ficam a um toque de distância.
 */
export default function AdminLayout({ children, tenant, user, role, profile, hideTopBar }) {
  const router = useRouter()
  const barRef = useRef(null)

  const NAV_ITEMS = [
    { href: '/admin/conversations', label: 'Conversas', icon: '💬' },
    { href: '/admin/contacts', label: 'Contatos', icon: '👥' },
    { href: '/admin/products', label: 'Catálogo', icon: '📦' },
    { href: '/admin/agendamentos', label: 'Agendamentos', icon: '🗓️' },
    { href: '/admin/whatsapp-setup', label: 'Conectar WhatsApp', icon: '📱' },
    { href: '/admin/bots', label: 'Configurar Bot', icon: '🤖' },
    { href: '/admin/marketing', label: 'Marketing', icon: '📣' },
    { href: '/admin/analytics', label: 'Analytics', icon: '📊' },
    { href: '/admin/financeiro', label: 'Financeiro', icon: '💰' },
    { href: '/admin/settings', label: 'Configurações', icon: '⚙️' },
    { href: '/admin/upgrade', label: 'Upgrades', icon: '⬆️' },
    { href: '/admin/api', label: 'API', icon: '🔌' },
  ]
  if (profile?.is_platform_admin) NAV_ITEMS.push({ href: '/painel', label: 'Painel Arkiel', icon: '⚡' })

  const isActive = (item) => item.href === '/admin/conversations'
    ? router.pathname === '/admin' || router.pathname.startsWith(item.href + '/') || router.pathname === item.href
    : router.pathname === item.href || router.pathname.startsWith(item.href + '/')

  // Mantém a seção ativa visível: rola a barra pro item atual
  useEffect(() => {
    const el = barRef.current?.querySelector('[data-active="true"]')
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [router.asPath])

  if (hideTopBar) {
    return <div className="ark-layout-main" style={{ height: '100dvh', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column' }}><div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>{children}</div></div>
  }

  return (
    <div className="ark-layout-main" style={{ height: '100dvh', overflow: 'hidden', background: 'var(--bg-main)', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar: marca (esquerda) + conta (direita) */}
      <header style={{
        height: 56, background: 'var(--bg-topbar)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px', paddingTop: 'env(safe-area-inset-top, 0px)',
        flexShrink: 0, zIndex: 100,
      }}>
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

        {/* Conta: leva às Configurações (onde ficam perfil e Sair) */}
        <Link href="/admin/settings" title="Configurações da conta"
          style={{ width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', border: '1.5px solid var(--border-strong)', textDecoration: 'none' }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{(user?.email || '?')[0].toUpperCase()}</span>}
        </Link>
      </header>

      {/* Barra de navegação única: horizontal, sempre visível, rolável */}
      <nav ref={barRef} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', flexShrink: 0,
        overflowX: 'auto', overflowY: 'hidden',
        whiteSpace: 'nowrap', scrollbarWidth: 'none',
        background: 'var(--bg-topbar)',
        borderBottom: '1px solid var(--border-soft)',
        WebkitOverflowScrolling: 'touch',
      }}>
        {NAV_ITEMS.map(item => {
          const active = isActive(item)
          return (
            <Link key={item.href} href={item.href} data-active={active ? 'true' : 'false'} title={item.label}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 999, textDecoration: 'none',
                fontSize: 13, fontWeight: active ? 700 : 500,
                color: active ? '#4f8ef7' : 'var(--text-secondary)',
                background: active ? 'var(--blue-tint)' : 'var(--bg-secondary)',
                border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-soft)'}`,
                flexShrink: 0,
                transition: 'all 0.15s',
              }}>
              <span style={{ fontSize: 14 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Conteúdo */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, WebkitOverflowScrolling: 'touch' }}>
        {children}
      </div>
    </div>
  )
}
