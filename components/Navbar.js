import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

export default function Navbar() {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)

  const navLinks = [
    { label: 'Produtos', href: '/#produtos' },
    { label: 'Soluções', href: '/#solucoes' },
    { label: 'Preços', href: '/#precos' },
    { label: 'Empresa', href: '/#empresa' },
  ]

  return (
    <>
      <style>{`
        .ark-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          height: 68px;
          display: flex; align-items: center;
          padding: 0 40px;
          justify-content: space-between;
        }
        .ark-nav-logo {
          display: flex; align-items: center; gap: 12px;
          text-decoration: none;
        }
        .ark-nav-logo img { width: 36px; height: 36px; object-fit: contain; }
        .ark-nav-logo-text {
          font-size: 15px; font-weight: 800; letter-spacing: 4px;
          color: #fff; text-transform: uppercase;
        }
        .ark-nav-links {
          display: flex; align-items: center; gap: 4px;
          list-style: none;
        }
        .ark-nav-links a {
          padding: 7px 14px; border-radius: 8px;
          font-size: 13px; font-weight: 500; color: rgba(255,255,255,0.55);
          text-decoration: none; transition: all 0.15s;
        }
        .ark-nav-links a:hover { color: #fff; background: rgba(255,255,255,0.06); }
        .ark-nav-cta {
          display: flex; align-items: center; gap: 10px;
        }
        .btn-nav-ghost {
          padding: 8px 18px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.12);
          color: rgba(255,255,255,0.65); font-size: 13px; font-weight: 500;
          text-decoration: none; transition: all 0.15s; background: transparent;
        }
        .btn-nav-ghost:hover { border-color: rgba(255,255,255,0.25); color: #fff; }
        .btn-nav-primary {
          padding: 8px 20px; border-radius: 8px;
          background: #fff; color: #000;
          font-size: 13px; font-weight: 700;
          text-decoration: none; transition: all 0.15s;
          letter-spacing: -0.2px;
        }
        .btn-nav-primary:hover { background: rgba(255,255,255,0.88); transform: translateY(-1px); }
        .ark-hamburger {
          display: none; flex-direction: column; gap: 5px; cursor: pointer;
          background: none; border: none; padding: 4px;
        }
        .ark-hamburger span {
          display: block; width: 22px; height: 2px;
          background: rgba(255,255,255,0.7); border-radius: 2px;
          transition: all 0.2s;
        }
        .ark-mobile-menu {
          display: none;
          position: fixed; top: 68px; left: 0; right: 0;
          background: rgba(0,0,0,0.95); backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 20px 24px 28px; z-index: 199; flex-direction: column; gap: 8px;
        }
        .ark-mobile-menu.open { display: flex; }
        .ark-mobile-menu a {
          padding: 12px 16px; border-radius: 8px;
          font-size: 15px; font-weight: 500; color: rgba(255,255,255,0.7);
          text-decoration: none; display: block; transition: all 0.15s;
        }
        .ark-mobile-menu a:hover { background: rgba(255,255,255,0.05); color: #fff; }
        .ark-mobile-menu .mobile-divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }
        @media (max-width: 768px) {
          .ark-nav { padding: 0 20px; }
          .ark-nav-links, .ark-nav-cta { display: none; }
          .ark-hamburger { display: flex; }
        }
      `}</style>

      <nav className="ark-nav">
        <Link href="/" className="ark-nav-logo">
          <img src="/arkiel-logo.png" alt="Arkiel" />
          <span className="ark-nav-logo-text">Arkiel</span>
        </Link>

        <ul className="ark-nav-links">
          {navLinks.map(l => (
            <li key={l.label}><Link href={l.href}>{l.label}</Link></li>
          ))}
        </ul>

        <div className="ark-nav-cta">
          <Link href="/login" className="btn-nav-ghost">Entrar</Link>
          <Link href="/login" className="btn-nav-primary">Começar agora →</Link>
        </div>

        <button className="ark-hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      <div className={`ark-mobile-menu ${menuOpen ? 'open' : ''}`}>
        {navLinks.map(l => (
          <Link key={l.label} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</Link>
        ))}
        <div className="mobile-divider" />
        <Link href="/login" onClick={() => setMenuOpen(false)} style={{ color: 'rgba(255,255,255,0.5)' }}>Entrar na conta</Link>
        <Link href="/login" onClick={() => setMenuOpen(false)} style={{ background: '#fff', color: '#000', fontWeight: 700, borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>Começar agora →</Link>
      </div>
    </>
  )
}
