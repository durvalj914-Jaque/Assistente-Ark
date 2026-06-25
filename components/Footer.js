import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <>
      <style>{`
        .ark-footer {
          border-top: 1px solid rgba(255,255,255,0.06);
          background: #000;
          padding: 64px 80px 40px;
          position: relative; z-index: 1;
        }
        .ark-footer-grid {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
          gap: 48px;
          margin-bottom: 56px;
        }
        .footer-brand img { width: 40px; height: 40px; object-fit: contain; margin-bottom: 16px; }
        .footer-brand-name {
          font-size: 14px; font-weight: 800; letter-spacing: 4px;
          color: #fff; text-transform: uppercase; margin-bottom: 14px;
        }
        .footer-brand-desc {
          font-size: 13px; color: rgba(255,255,255,0.3);
          line-height: 1.7; max-width: 260px; margin-bottom: 24px;
        }
        .footer-social { display: flex; gap: 10px; }
        .footer-social a {
          width: 34px; height: 34px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; text-decoration: none; color: rgba(255,255,255,0.5);
          transition: all 0.15s;
        }
        .footer-social a:hover { border-color: rgba(255,255,255,0.25); color: #fff; background: rgba(255,255,255,0.05); }
        .footer-col-title {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: rgba(255,255,255,0.25); text-transform: uppercase; margin-bottom: 18px;
        }
        .footer-col-links { display: flex; flex-direction: column; gap: 11px; }
        .footer-col-links a {
          font-size: 13px; color: rgba(255,255,255,0.45);
          text-decoration: none; transition: color 0.15s; font-weight: 400;
        }
        .footer-col-links a:hover { color: rgba(255,255,255,0.9); }
        .footer-bottom {
          display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid rgba(255,255,255,0.05); padding-top: 28px;
          flex-wrap: wrap; gap: 16px;
        }
        .footer-bottom-left { font-size: 12px; color: rgba(255,255,255,0.2); }
        .footer-bottom-right { display: flex; gap: 24px; }
        .footer-bottom-right a {
          font-size: 12px; color: rgba(255,255,255,0.25);
          text-decoration: none; transition: color 0.15s;
        }
        .footer-bottom-right a:hover { color: rgba(255,255,255,0.6); }
        @media (max-width: 900px) {
          .ark-footer { padding: 48px 24px 32px; }
          .ark-footer-grid { grid-template-columns: 1fr 1fr; gap: 36px; }
          .footer-brand { grid-column: 1 / -1; }
        }
        @media (max-width: 500px) {
          .ark-footer-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <footer className="ark-footer">
        <div className="ark-footer-grid">
          <div className="footer-brand">
            <img src="/arkiel-logo.png" alt="Arkiel" />
            <div className="footer-brand-name">Arkiel</div>
            <p className="footer-brand-desc">
              Plataforma de automação inteligente para WhatsApp Business. Escale seu atendimento com IA, sem código e sem complicação.
            </p>
            <div className="footer-social">
              <a href="https://instagram.com/arkiel" target="_blank" rel="noreferrer" title="Instagram">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/></svg>
              </a>
              <a href="https://linkedin.com/company/arkiel" target="_blank" rel="noreferrer" title="LinkedIn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer" title="WhatsApp">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              </a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Produtos</div>
            <div className="footer-col-links">
              <Link href="/#produtos">Assistente Ark</Link>
              <Link href="/#produtos">Ark AOI</Link>
              <Link href="/#solucoes">Automações</Link>
              <Link href="/#solucoes">Analytics</Link>
              <Link href="/#precos">Preços</Link>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Empresa</div>
            <div className="footer-col-links">
              <Link href="/#empresa">Sobre nós</Link>
              <Link href="/#empresa">Missão</Link>
              <a href="mailto:arkieltech@gmail.com">Contato</a>
              <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Suporte</div>
            <div className="footer-col-links">
              <Link href="/client">Área do Cliente</Link>
              <a href="mailto:arkieltech@gmail.com">Suporte técnico</a>
              <a href="https://wa.me/5511913751590" target="_blank" rel="noreferrer">Chat ao vivo</a>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Legal</div>
            <div className="footer-col-links">
              <Link href="/termos">Termos de Uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/cookies">Cookies</Link>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <span className="footer-bottom-left">
            © {year} Arkiel Tecnologia LTDA. Todos os direitos reservados.
          </span>
          <div className="footer-bottom-right">
            <Link href="/termos">Termos</Link>
            <Link href="/privacidade">Privacidade</Link>
            <Link href="/cookies">Cookies</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
