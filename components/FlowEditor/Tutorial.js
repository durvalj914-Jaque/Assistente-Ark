export default function Tutorial({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#0d0d1e', border: '1px solid rgba(79,142,247,0.25)', borderRadius: 16, padding: 28, width: 520, maxHeight: '88vh', overflowY: 'auto' }}>
        <h3 style={{ color: '#fff', fontWeight: 700, fontSize: 16, marginBottom: 20 }}>🧭 Como funciona o Editor de Fluxo</h3>

        <div style={{ color: '#cbd5e1', fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ marginBottom: 16 }}>
            <b style={{ color: '#4f8ef7' }}>O conceito:</b> O fluxo é uma árvore de <b>blocos</b>. Cada bloco é igual — tem um texto e botões. 
            Simples assim.
          </p>

          <div style={{ background: 'rgba(79,142,247,0.06)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ fontWeight: 700, color: '#4f8ef7', fontSize: 12, marginBottom: 8 }}>Cada bloco contém:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              <li>📝 <b style={{ color: '#e2e8f0' }}>Texto</b> — o que o bot envia</li>
              <li>🔘 <b style={{ color: '#e2e8f0' }}>Botões</b> — o cliente toca para escolher (sem digitar)</li>
              <li>⚡ <b style={{ color: '#e2e8f0' }}>Ação</b> — opcional (transferir, catálogo, cobrar)</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(34,197,94,0.06)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ fontWeight: 700, color: '#22c55e', fontSize: 12, marginBottom: 8 }}>Como navegar:</p>
            <ol style={{ padding: 0, margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.8, listStyle: 'none' }}>
              <li>1. Clique no bloco para editar</li>
              <li>2. Escreva o texto e adicione botões</li>
              <li>3. Cada botão cria <b style={{ color: '#e2e8f0' }}>automaticamente</b> um novo bloco abaixo</li>
              <li>4. O nome do bloco filho é o texto do botão</li>
              <li>5. Clique no bloco filho para continuar o fluxo</li>
            </ol>
          </div>

          <div style={{ background: 'rgba(139,92,246,0.06)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ fontWeight: 700, color: '#a78bfa', fontSize: 12, marginBottom: 8 }}>Ações especiais:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              <li>🙋 <b>Transferir</b> — passa para atendente humano</li>
              <li>📦 <b>Catálogo</b> — mostra produtos do WhatsApp</li>
              <li>💰 <b>Cobrar</b> — envia cobrança PIX/MP</li>
              <li>🔚 <b>Encerrar</b> — finaliza a conversa</li>
            </ul>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Blocos com ação não precisam de botões.</p>
          </div>

          <div style={{ background: 'rgba(245,158,11,0.06)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <p style={{ fontWeight: 700, color: '#f59e0b', fontSize: 12, marginBottom: 8 }}>Limites do WhatsApp:</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.8 }}>
              <li>1-3 botões → botões interativos (toque direto)</li>
              <li>4-10 botões → lista de opções (menu "Ver opções")</li>
              <li>Máximo 10 botões por bloco</li>
              <li>Cada botão: até 20 caracteres</li>
            </ul>
          </div>

          <p style={{ fontSize: 12, color: '#475569', textAlign: 'center' }}>
            💡 O cliente sempre pode digitar <b style={{ color: '#4f8ef7' }}>0</b> para voltar ao menu inicial
          </p>
        </div>

        <button onClick={onClose}
          style={{ marginTop: 20, width: '100%', background: 'linear-gradient(135deg,#4f8ef7,#06b6d4)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          Entendi!
        </button>
      </div>
    </div>
  )
}
