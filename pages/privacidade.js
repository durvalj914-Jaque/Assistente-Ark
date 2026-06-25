import Head from 'next/head'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Privacidade() {
  return (
    <>
      <Head>
        <title>Política de Privacidade — Arkiel</title>
        <meta name="description" content="Política de privacidade e proteção de dados da Arkiel." />
      </Head>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #000; color: #fff; font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        .legal-root { background: #000; min-height: 100vh; }
        .legal-hero { padding: 140px 80px 60px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .legal-tag { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #4f8ef7; text-transform: uppercase; margin-bottom: 14px; }
        .legal-title { font-size: 48px; font-weight: 900; letter-spacing: -2px; color: #fff; margin-bottom: 12px; }
        .legal-date { font-size: 13px; color: rgba(255,255,255,0.25); }
        .legal-body { max-width: 760px; margin: 0 auto; padding: 60px 80px 80px; }
        .legal-body h2 { font-size: 20px; font-weight: 700; color: #fff; margin: 40px 0 14px; letter-spacing: -0.3px; }
        .legal-body h2:first-child { margin-top: 0; }
        .legal-body p { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.85; margin-bottom: 16px; }
        .legal-body ul { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
        .legal-body ul li { font-size: 14px; color: rgba(255,255,255,0.45); line-height: 1.7; padding-left: 16px; position: relative; }
        .legal-body ul li::before { content: '—'; position: absolute; left: 0; color: rgba(255,255,255,0.2); }
        .legal-contact { margin-top: 48px; padding: 28px 32px; border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; background: rgba(255,255,255,0.02); }
        .legal-contact p { margin: 0; }
        .legal-contact a { color: #4f8ef7; text-decoration: none; }
        @media (max-width: 768px) { .legal-hero, .legal-body { padding-left: 24px; padding-right: 24px; } .legal-title { font-size: 32px; } }
      `}</style>
      <div className="legal-root">
        <Navbar />
        <div className="legal-hero" style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div className="legal-tag">Legal</div>
          <h1 className="legal-title">Política de Privacidade</h1>
          <p className="legal-date">Última atualização: junho de 2025</p>
        </div>
        <div className="legal-body">
          <h2>1. Responsável pelo Tratamento</h2>
          <p>A Arkiel Tecnologia LTDA, com sede em São Paulo, SP, Brasil, é a controladora dos dados pessoais tratados através da Plataforma Arkiel, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018).</p>

          <h2>2. Dados Coletados</h2>
          <p>Coletamos os seguintes dados pessoais para operação da Plataforma:</p>
          <ul>
            <li>Dados de identificação: nome, e-mail, empresa</li>
            <li>Dados de autenticação: tokens de sessão (Google OAuth)</li>
            <li>Dados de uso: logs de acesso, métricas de utilização, preferências</li>
            <li>Dados de comunicação: conversas gerenciadas através da Plataforma</li>
            <li>Dados de pagamento: processados por terceiros certificados PCI-DSS</li>
          </ul>

          <h2>3. Finalidade do Tratamento</h2>
          <p>Os dados são tratados para:</p>
          <ul>
            <li>Prestação dos serviços contratados</li>
            <li>Autenticação e segurança da conta</li>
            <li>Comunicações sobre a conta e serviços</li>
            <li>Melhoria contínua da Plataforma</li>
            <li>Cumprimento de obrigações legais</li>
          </ul>

          <h2>4. Base Legal</h2>
          <p>O tratamento de dados é fundamentado em: execução de contrato (Art. 7º, V da LGPD), legítimo interesse (Art. 7º, IX) e cumprimento de obrigação legal (Art. 7º, II), conforme aplicável a cada finalidade.</p>

          <h2>5. Compartilhamento de Dados</h2>
          <p>Os dados podem ser compartilhados com:</p>
          <ul>
            <li>Supabase — infraestrutura de banco de dados e autenticação</li>
            <li>Vercel — hospedagem e entrega de conteúdo</li>
            <li>Google — autenticação OAuth</li>
            <li>Meta (WhatsApp Business API) — envio e recebimento de mensagens</li>
          </ul>
          <p>Não vendemos ou cedemos dados pessoais a terceiros para fins comerciais.</p>

          <h2>6. Segurança dos Dados</h2>
          <p>Implementamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia em trânsito (TLS) e em repouso, controle de acesso baseado em papéis, monitoramento contínuo e backups automáticos.</p>

          <h2>7. Retenção de Dados</h2>
          <p>Os dados são mantidos pelo período necessário à prestação dos serviços e cumprimento de obrigações legais. Após o encerramento da conta, os dados são anonimizados ou excluídos em até 90 dias, salvo obrigação legal de retenção.</p>

          <h2>8. Direitos do Titular</h2>
          <p>Nos termos da LGPD, você tem direito a:</p>
          <ul>
            <li>Confirmação e acesso aos seus dados</li>
            <li>Correção de dados incompletos ou desatualizados</li>
            <li>Anonimização, bloqueio ou eliminação de dados</li>
            <li>Portabilidade dos dados</li>
            <li>Revogação do consentimento</li>
            <li>Oposição ao tratamento</li>
          </ul>

          <h2>9. Cookies e Tecnologias Similares</h2>
          <p>Utilizamos cookies essenciais para autenticação e funcionamento da Plataforma. Cookies analíticos são utilizados para melhoria do serviço. Consulte nossa <a href="/cookies" style={{ color: '#4f8ef7', textDecoration: 'none' }}>Política de Cookies</a> para detalhes.</p>

          <h2>10. Contato do DPO</h2>
          <p>Para exercer seus direitos ou esclarecer dúvidas sobre privacidade, entre em contato com nosso Encarregado de Dados (DPO):</p>

          <div className="legal-contact">
            <p>📧 <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a> — resposta em até 15 dias úteis.</p>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
