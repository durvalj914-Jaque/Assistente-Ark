import { useState } from 'react'

// Paleta igual à do FlowEditor/index.js — mantém consistência visual entre o
// tutorial e o editor de verdade.
const C = {
  welcome:   '#06b6d4',
  message:   '#4f8ef7',
  menu:      '#8b5cf6',
  input:     '#f59e0b',
  condition: '#10b981',
  transfer:  '#f97316',
  end:       '#ef4444',
  line:      'rgba(79,142,247,0.35)',
  panel:     '#0d0d1e',
  panelBorder: 'rgba(79,142,247,0.18)',
}

const NODE_TYPES = [
  { key: 'welcome',   icon: '👋', label: 'Boas-vindas', color: C.welcome,
    what: 'A primeira mensagem que o bot manda quando alguém escreve pela primeira vez (ou digita um comando de reset). Todo fluxo começa com um nó desse tipo — é a "raiz" da árvore.' },
  { key: 'message',   icon: '💬', label: 'Mensagem', color: C.message,
    what: 'Um passo simples: o bot manda esse texto e segue direto pro próximo nó (o que estiver conectado logo abaixo com o botão "+"). Use pra explicações, instruções, textos informativos.' },
  { key: 'menu',      icon: '📋', label: 'Menu', color: C.menu,
    what: 'Mostra o texto e ESPERA o cliente responder com uma palavra-chave (ex: "1", "2", "sim"). Cada opção que você cadastrar leva pra um ramo diferente — é o único tipo de nó que realmente ramifica a conversa.' },
  { key: 'input',     icon: '✏️', label: 'Input', color: C.input,
    what: 'Pede uma informação livre (nome, e-mail, etc). Hoje ele funciona como um passo comum — manda o texto e segue pro próximo nó; ainda não guarda a resposta do cliente como variável.' },
  { key: 'condition', icon: '🔀', label: 'Condição', color: C.condition,
    what: 'Pensado pra decisões automáticas no futuro. Por enquanto se comporta como uma "Mensagem" (avança pro próximo nó) — use mais como uma anotação visual no fluxo.' },
  { key: 'transfer',  icon: '🙋', label: 'Transferir', color: C.transfer,
    what: 'Encerra o atendimento automático: a conversa muda de status pra "humano" e some da fila do bot até alguém da equipe responder pelo painel de Conversas.' },
  { key: 'end',       icon: '🔚', label: 'Encerrar', color: C.end,
    what: 'Fecha a conversa (status "encerrada"). Se o cliente mandar qualquer mensagem depois, o fluxo reinicia do zero, do nó Boas-vindas.' },
]

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 34 }}>
      <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title}</h3>
      {children}
    </div>
  )
}

function MiniCard({ x, y, w = 132, h = 46, color, icon, label, small }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect width={w} height={h} rx={9} fill="#0d0d1e" stroke={color} strokeWidth="1.5" />
      <text x={10} y={18} fontSize="11" fill={color} fontWeight="700">{icon} {label}</text>
      {small && <text x={10} y={34} fontSize="9" fill="#64748b">{small}</text>}
    </g>
  )
}

function Arrow({ x1, y1, x2, y2 }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.line} strokeWidth="2" markerEnd="url(#arrowhead)" />
}

// ── Diagrama 1: anatomia de um nó ──────────────────────────────
function DiagramAnatomy() {
  return (
    <svg viewBox="0 0 620 220" style={{ width: '100%', maxWidth: 560 }}>
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={C.line} />
        </marker>
      </defs>

      {/* card principal */}
      <rect x="210" y="10" width="200" height="90" rx="12" fill="#0d0d1e" stroke={C.menu} strokeWidth="2" />
      <text x="222" y="34" fontSize="12" fill={C.menu} fontWeight="700">📋 MENU</text>
      <text x="222" y="54" fontSize="11" fill="#cbd5e1">Diga o que deseja...</text>
      <rect x="222" y="64" width="90" height="14" rx="4" fill="rgba(139,92,246,0.12)" />
      <text x="227" y="74" fontSize="8.5" fill="#a78bfa">1. Conhecer produto</text>

      {/* botão x */}
      <circle cx="398" cy="24" r="8" fill="transparent" stroke="#475569" />
      <text x="394" y="28" fontSize="11" fill="#475569">×</text>

      {/* botões abaixo */}
      <rect x="255" y="108" width="26" height="20" rx="5" fill="rgba(79,142,247,0.12)" stroke={C.message} />
      <text x="263" y="122" fontSize="12" fill={C.message} fontWeight="700">+</text>
      <rect x="290" y="108" width="52" height="20" rx="5" fill="rgba(139,92,246,0.12)" stroke={C.menu} />
      <text x="296" y="122" fontSize="9" fill={C.menu} fontWeight="700">+ ramo</text>

      {/* callouts */}
      <line x1="210" y1="24" x2="60" y2="24" stroke="#334155" strokeDasharray="3,3" />
      <text x="10" y="20" fontSize="10.5" fill="#94a3b8">ícone + tipo do nó</text>
      <text x="10" y="30" fontSize="9" fill="#475569">(clique no card pra editar)</text>

      <line x1="210" y1="54" x2="60" y2="70" stroke="#334155" strokeDasharray="3,3" />
      <text x="10" y="75" fontSize="10.5" fill="#94a3b8">mensagem que o bot manda</text>

      <line x1="222" y1="70" x2="60" y2="100" stroke="#334155" strokeDasharray="3,3" />
      <text x="10" y="105" fontSize="10.5" fill="#94a3b8">opções do menu (só aparece</text>
      <text x="10" y="117" fontSize="10.5" fill="#94a3b8">nesse tipo de nó)</text>

      <line x1="406" y1="24" x2="560" y2="24" stroke="#334155" strokeDasharray="3,3" />
      <text x="450" y="20" fontSize="10.5" fill="#94a3b8">remover nó</text>

      <line x1="268" y1="128" x2="230" y2="165" stroke="#334155" strokeDasharray="3,3" />
      <text x="150" y="180" fontSize="10.5" fill="#94a3b8">"+" adiciona o PRÓXIMO passo</text>
      <text x="150" y="192" fontSize="10.5" fill="#94a3b8">(sequência linear, um atrás do outro)</text>

      <line x1="316" y1="128" x2="380" y2="165" stroke="#334155" strokeDasharray="3,3" />
      <text x="360" y="180" fontSize="10.5" fill="#94a3b8">"+ ramo" cria uma opção</text>
      <text x="360" y="192" fontSize="10.5" fill="#94a3b8">PARALELA (outro caminho possível)</text>
    </svg>
  )
}

// ── Diagrama 2: linear vs ramo ──────────────────────────────
function DiagramLinearVsBranch() {
  return (
    <svg viewBox="0 0 620 190" style={{ width: '100%', maxWidth: 560 }}>
      {/* Linear */}
      <text x="20" y="16" fontSize="11" fill="#64748b" fontWeight="700">SEQUÊNCIA LINEAR ("+")</text>
      <MiniCard x={20} y={26} color={C.welcome} icon="👋" label="Boas-vindas" />
      <Arrow x1={86} y1={72} x2={86} y2={92} />
      <MiniCard x={20} y={94} color={C.message} icon="💬" label="Mensagem" />
      <Arrow x1={86} y1={140} x2={86} y2={160} />
      <MiniCard x={20} y={162} color={C.end} icon="🔚" label="Encerrar" />

      {/* Ramos */}
      <text x="320" y="16" fontSize="11" fill="#64748b" fontWeight="700">RAMOS PARALELOS ("+ ramo")</text>
      <MiniCard x={370} y={26} color={C.menu} icon="📋" label="Menu" />
      <Arrow x1={370} y1={60} x2={320} y2={92} />
      <Arrow x1={402} y1={72} x2={402} y2={92} />
      <Arrow x1={434} y1={60} x2={484} y2={92} />
      <MiniCard x={280} y={94} w={90} color={C.message} icon="💬" label="Opção 1" />
      <MiniCard x={382} y={94} w={90} color={C.message} icon="💬" label="Opção 2" />
      <MiniCard x={484} y={94} w={90} color={C.message} icon="💬" label="Opção 3" />
    </svg>
  )
}

// ── Diagrama 3: menu -> ordem das opções = ordem dos ramos ──────────────────────────────
function DiagramMenuMapping() {
  return (
    <svg viewBox="0 0 620 230" style={{ width: '100%', maxWidth: 560 }}>
      <rect x="20" y="10" width="180" height="120" rx="10" fill="#0d0d1e" stroke={C.menu} strokeWidth="2" />
      <text x="32" y="30" fontSize="11" fill={C.menu} fontWeight="700">📋 MENU</text>
      <text x="32" y="48" fontSize="10" fill="#cbd5e1">Diga o que deseja</text>
      <rect x="32" y="58" width="150" height="15" rx="4" fill="rgba(139,92,246,0.10)" />
      <text x="37" y="68.5" fontSize="8.5" fill="#a78bfa">1. Conhecer produto (kw: 1)</text>
      <rect x="32" y="77" width="150" height="15" rx="4" fill="rgba(139,92,246,0.10)" />
      <text x="37" y="87.5" fontSize="8.5" fill="#a78bfa">2. Suporte técnico (kw: 2)</text>
      <rect x="32" y="96" width="150" height="15" rx="4" fill="rgba(139,92,246,0.10)" />
      <text x="37" y="106.5" fontSize="8.5" fill="#a78bfa">3. Falar com humano (kw: 4)</text>

      <MiniCard x={260} y={10} w={150} color={C.message} icon="💬" label="1º ramo" small="conecta à opção 1" />
      <MiniCard x={260} y={72} w={150} color={C.message} icon="💬" label="2º ramo" small="conecta à opção 2" />
      <MiniCard x={260} y={134} w={150} color={C.transfer} icon="🙋" label="3º ramo" small="conecta à opção 3" />

      <Arrow x1={200} y1={65} x2={258} y2={33} />
      <Arrow x1={200} y1={84} x2={258} y2={95} />
      <Arrow x1={200} y1={103} x2={258} y2={157} />

      <text x="20" y="195" fontSize="10.5" fill="#f59e0b">⚠️ A ordem importa:</text>
      <text x="20" y="212" fontSize="10.5" fill="#94a3b8">a 1ª opção do menu sempre liga ao 1º ramo criado com "+ ramo",</text>
      <text x="20" y="225" fontSize="10.5" fill="#94a3b8">a 2ª opção ao 2º ramo, e assim por diante — crie na mesma ordem.</text>
    </svg>
  )
}

// ── Diagrama 4: exemplo completo ──────────────────────────────
function DiagramFullExample() {
  return (
    <svg viewBox="0 0 700 300" style={{ width: '100%', maxWidth: 640 }}>
      <MiniCard x={280} y={10} w={140} color={C.welcome} icon="👋" label="Boas-vindas" small="Olá! Sou o Ark 🤖" />
      <Arrow x1={350} y1={56} x2={350} y2={76} />
      <MiniCard x={270} y={78} w={160} color={C.menu} icon="📋" label="Menu principal" small="1 produto·2 suporte·3 humano" />

      <Arrow x1={300} y1={124} x2={110} y2={166} />
      <Arrow x1={350} y1={130} x2={350} y2={166} />
      <Arrow x1={400} y1={124} x2={590} y2={166} />

      <MiniCard x={40}  y={168} w={140} color={C.message} icon="💬" label="Sobre o produto" small='opção "1"' />
      <MiniCard x={280} y={168} w={140} color={C.message} icon="💬" label="Suporte técnico" small='opção "2"' />
      <MiniCard x={520} y={168} w={140} color={C.transfer} icon="🙋" label="Falar com humano" small='opção "3"' />

      <Arrow x1={110} y1={214} x2={110} y2={236} />
      <MiniCard x={40} y={238} w={140} color={C.end} icon="🔚" label="Encerrar" small="ou volta ao menu" />

      <text x="20" y="290" fontSize="10.5" fill="#64748b">💡 Em qualquer ponto, se o cliente digitar "0" ou "menu", ele volta direto pro Boas-vindas.</text>
    </svg>
  )
}

export default function Tutorial({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.panel, border: `1px solid ${C.panelBorder}`, borderRadius: 16, padding: '28px 32px', width: '100%', maxWidth: 760, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>🧭 Como usar o Editor de Fluxo</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20 }}>✕</button>
        </div>
        <p style={{ color: '#64748b', fontSize: 12.5, marginBottom: 26 }}>
          O fluxo é a árvore de conversa que o bot segue no WhatsApp. Cada nó é um passo — uma mensagem, um menu, uma transferência — e as setas mostram pra onde o bot vai depois.
        </p>

        <Section title="1. Anatomia de um nó">
          <DiagramAnatomy />
        </Section>

        <Section title="2. Tipos de nó disponíveis">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {NODE_TYPES.map(t => (
              <div key={t.key} style={{ background: '#12121f', border: `1px solid ${t.color}33`, borderRadius: 10, padding: '10px 12px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.color, marginBottom: 4 }}>{t.icon} {t.label}</div>
                <div style={{ fontSize: 11.5, color: '#94a3b8', lineHeight: 1.5 }}>{t.what}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="3. Sequência linear x ramos paralelos">
          <DiagramLinearVsBranch />
          <p style={{ color: '#64748b', fontSize: 11.5, marginTop: 8 }}>
            Use <b style={{ color: C.message }}>+</b> quando o próximo passo é sempre o mesmo (uma sequência).
            Use <b style={{ color: C.menu }}>+ ramo</b> quando você quer criar caminhos diferentes a partir de um <b>Menu</b> — cada ramo vira uma opção.
          </p>
        </Section>

        <Section title="4. Menu: como ligar cada opção ao ramo certo">
          <DiagramMenuMapping />
          <p style={{ color: '#64748b', fontSize: 11.5, marginTop: 8 }}>
            No card do nó Menu, cada opção tem um <b>texto</b> (o que aparece pro cliente) e uma <b>palavra-chave</b> (o que o cliente precisa digitar, ex: "1", "sim", "suporte"). Crie as opções e os ramos na mesma ordem.
          </p>
        </Section>

        <Section title="5. Comandos automáticos do cliente">
          <p style={{ color: '#94a3b8', fontSize: 12, lineHeight: 1.6 }}>
            Em qualquer ponto da conversa, se o cliente digitar <b style={{ color: '#fff' }}>0</b>, <b style={{ color: '#fff' }}>menu</b>, <b style={{ color: '#fff' }}>início</b>, <b style={{ color: '#fff' }}>reiniciar</b> ou <b style={{ color: '#fff' }}>começar</b>, o fluxo pula direto de volta pro nó <b>Boas-vindas</b> — não precisa configurar nada, isso já funciona sempre.
          </p>
        </Section>

        <Section title="6. Exemplo completo">
          <DiagramFullExample />
        </Section>

        <div style={{ background: 'rgba(79,142,247,0.08)', border: '1px solid rgba(79,142,247,0.2)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: '#94a3b8' }}>
          💾 Depois de montar ou editar o fluxo, sempre clique em <b style={{ color: '#4f8ef7' }}>Salvar fluxo</b> no topo da página — sem isso, as mudanças ficam só na tela e não valem pro bot no WhatsApp.
        </div>
      </div>
    </div>
  )
}
