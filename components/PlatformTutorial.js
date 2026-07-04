// Tutorial do Painel Arkiel — explica o conceito de "cliente" (tenant), como o
// cadastro automático funciona, quando usar cada seção da tela e o que cada
// botão faz. Segue o mesmo estilo visual do Tutorial do Editor de Fluxo.

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: 'rgba(79,142,247,0.15)',
        border: '1px solid rgba(79,142,247,0.4)', color: '#4f8ef7', fontSize: 11, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
      }}>{n}</div>
      <div>
        <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        <div style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

export default function PlatformTutorial({ onClose }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: '30px 32px', width: 640, maxWidth: '100%', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 17 }}>🧭 Como funciona o Painel Arkiel</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <Section title="O que é um &quot;cliente&quot; aqui?">
          <p style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6, marginBottom: 8 }}>
            Cada <b style={{ color: '#e2e8f0' }}>cliente</b> é uma empresa que usa o Assistente Ark — tecnicamente chamado de <b style={{ color: '#e2e8f0' }}>tenant</b>. Cada uma tem seus próprios bots, contatos, conversas e fluxo, totalmente isolados das outras. Ninguém de uma empresa vê dados de outra.
          </p>
        </Section>

        <Section title="Duas formas de uma empresa virar cliente">
          <Step n="A" title="Cadastro automático (o normal)">
            A empresa entra em <code style={{ color: '#4f8ef7' }}>arkiel.com.br/login</code> e faz login com o Google dela. Isso já cria a conta, o tenant e um bot padrão sozinho — você não precisa fazer nada.
          </Step>
          <Step n="B" title="Você cria antes (venda direta / offline)">
            Quando fecha com um cliente que ainda não entrou no site, use o botão <b style={{ color: '#e2e8f0' }}>"+ Novo Cliente"</b> aqui embaixo. Você informa o nome da empresa, o e-mail Google que ela vai usar pra entrar, e o plano — o sistema já deixa a conta e o bot prontos. Quando essa pessoa entrar de fato com esse e-mail, ela cai direto na conta certa, nada duplica.
          </Step>
        </Section>

        <Section title="O que cada seção da tela faz">
          <Step n="1" title="🏢 Clientes">
            Lista todas as empresas cadastradas: nome, plano, status do bot (conectado ou não) e quem já entrou ou ainda está com convite pendente. Clique em <b style={{ color: '#e2e8f0' }}>"Gerenciar"</b> num cliente pra mudar o plano dele ou preencher os dados do WhatsApp (Phone Number ID, WABA ID, Token) — isso ativa o bot pra valer.
          </Step>
          <Step n="2" title="📋 Pedidos de conexão WhatsApp">
            Quando um cliente JÁ cadastrado pede pra conectar o número dele (formulário "Conectar WhatsApp" no painel dele), o pedido cai aqui. Você processa manualmente com a Meta e preenche os dados de volta.
          </Step>
        </Section>

        <Section title="Depois de criar um cliente novo">
          <p style={{ color: '#94a3b8', fontSize: 12.5, lineHeight: 1.6 }}>
            Se já tiver os dados do WhatsApp na hora, clique em "Gerenciar" no card do cliente recém-criado e preencha ali mesmo — o bot já nasce ativo. Se não tiver ainda, deixa assim mesmo: o cliente entra, vê o painel dele funcionando (com um fluxo de exemplo pra ele aprender), e quando o WhatsApp estiver pronto, você (ou ele, pelo próprio painel) conecta depois.
          </p>
        </Section>
      </div>
    </div>
  )
}
