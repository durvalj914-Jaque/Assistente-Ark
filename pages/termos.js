import Head from 'next/head'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'

export default function Termos() {
  return (
    <>
      <Head>
        <title>Termos de Uso — Arkiel</title>
        <meta name="description" content="Termos de uso da plataforma Arkiel." />
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
          <h1 className="legal-title">Termos de Uso</h1>
          <p className="legal-date">Última atualização: junho de 2025</p>
        </div>
        <div className="legal-body">
          <h2>1. Aceitação dos Termos</h2>
          <p>Ao acessar ou utilizar a plataforma Arkiel ("Plataforma"), você concorda em cumprir e estar vinculado a estes Termos de Uso. Caso não concorde com qualquer parte destes termos, não utilize a Plataforma.</p>

          <h2>2. Descrição do Serviço</h2>
          <p>A Arkiel Tecnologia LTDA disponibiliza uma plataforma SaaS (Software as a Service) para automação de atendimento via WhatsApp Business, incluindo os produtos Assistente Ark e Ark AOI. Os serviços incluem:</p>
          <ul>
            <li>Criação e gestão de chatbots para WhatsApp Business</li>
            <li>Editor visual de fluxos de conversa</li>
            <li>Painel administrativo multi-tenant</li>
            <li>Analytics e relatórios de atendimento</li>
            <li>Integrações com sistemas externos via API</li>
          </ul>

          <h2>3. Cadastro e Conta</h2>
          <p>Para utilizar a Plataforma, você deve criar uma conta fornecendo informações verdadeiras e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades realizadas em sua conta.</p>
          <p>A Arkiel reserva-se o direito de suspender ou encerrar contas que violem estes Termos, envolvam fraude ou que apresentem atividade suspeita.</p>

          <h2>4. Uso Aceitável</h2>
          <p>Você concorda em utilizar a Plataforma apenas para fins legítimos e de acordo com a legislação brasileira vigente. É expressamente proibido:</p>
          <ul>
            <li>Utilizar a Plataforma para envio de spam ou mensagens não solicitadas</li>
            <li>Violar direitos de terceiros, incluindo propriedade intelectual</li>
            <li>Tentar acessar sistemas ou dados de outros usuários</li>
            <li>Realizar engenharia reversa ou tentativas de decompilação do software</li>
            <li>Utilizar a Plataforma para atividades ilegais ou fraudulentas</li>
          </ul>

          <h2>5. Pagamentos e Assinaturas</h2>
          <p>Os planos pagos são cobrados mensalmente ou anualmente, conforme a modalidade escolhida. O cancelamento pode ser realizado a qualquer momento, com efeito ao final do período vigente. Não há reembolso por períodos parciais, salvo disposição legal em contrário.</p>

          <h2>6. Propriedade Intelectual</h2>
          <p>Todo o conteúdo, software, marcas, logos e materiais da Plataforma são de propriedade exclusiva da Arkiel Tecnologia LTDA e protegidos pelas leis de propriedade intelectual brasileiras. O uso não autorizado é expressamente proibido.</p>

          <h2>7. Limitação de Responsabilidade</h2>
          <p>A Arkiel não se responsabiliza por danos indiretos, incidentais ou consequenciais decorrentes do uso ou incapacidade de uso da Plataforma. A responsabilidade total da Arkiel limita-se ao valor pago pelo usuário nos últimos 3 meses.</p>

          <h2>8. Disponibilidade e Manutenção</h2>
          <p>Nos comprometemos a manter a Plataforma disponível com uptime mínimo de 99% mensal. Manutenções programadas serão comunicadas com antecedência mínima de 24 horas.</p>

          <h2>9. Alterações nos Termos</h2>
          <p>A Arkiel pode modificar estes Termos a qualquer momento, notificando os usuários por e-mail ou através da Plataforma. O uso continuado após a notificação constitui aceitação dos novos termos.</p>

          <h2>10. Lei Aplicável e Foro</h2>
          <p>Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da comarca de São Paulo, SP, para dirimir quaisquer controvérsias decorrentes deste instrumento.</p>

          <div className="legal-contact">
            <p>Dúvidas sobre os Termos de Uso? Entre em contato: <a href="mailto:arkieltech@gmail.com">arkieltech@gmail.com</a></p>
          </div>
        </div>
        <Footer />
      </div>
    </>
  )
}
