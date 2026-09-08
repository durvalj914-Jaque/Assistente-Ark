import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

/**
 * Assistente de Migração — wizard de 3 etapas na aba Conectar WhatsApp.
 * Etapa 1: Preparar (checklist de backup antes de liberar o número)
 * Etapa 2: Conectar (slot com os cards de conexão existentes)
 * Etapa 3: Importar (status de contatos/produtos pós-conexão)
 * Progresso persiste em localStorage (ark-migration-checklist).
 */

const CHECK_KEY = 'ark-migration-checklist-v1'

const ITEMS = [
  { id: 'backup', icon: '☁️', title: 'Backup das conversas no Google Drive', desc: 'No app: Ajustes → Conversas → Backup → "Salvar". Suas conversas ficam guardadas no Drive mesmo depois da migração — e dão pra restaurar se um dia você voltar pro app.' },
  { id: 'export', icon: '📤', title: 'Exportei as conversas mais críticas', desc: 'Abra a conversa → ⋮ → Mais → Exportar conversa. Recomendado pra clientes, pedidos e acertos importantes (vai pro seu e-mail).' },
  { id: 'contacts', icon: '👥', title: 'Contatos prontos pra importar', desc: 'Exporte a agenda do celular (.vcf) ou conecte o Google Contatos. Depois da conexão, você importa na aba Contatos em 1 clique.' },
  { id: 'catalog', icon: '📦', title: 'Catálogo do app anotado (foto, nome, preço)', desc: 'Recadastrando na aba Catálogo, tudo vai pro catálogo oficial do WhatsApp automaticamente — com botão de compra.' },
  { id: 'groups', icon: '👥', title: 'Anotei os grupos em que o número participa', desc: 'Ao migrar pra API oficial, o número sai dos grupos — regra da Meta (a plataforma não cria nem gerencia grupos). Backup no Drive não devolve as participações: anote os grupos e peça readmissão depois da conexão.' },
  { id: 'freed', icon: '🔓', title: 'Conta excluída no app oficial do número', desc: 'Ajustes → Conta → Excluir minha conta → confirme. Isso libera o número pra plataforma. ⚠️ Só faça DEPOIS do backup (passo 1) e de anotar os grupos.' },
]

export default function MigrationWizard({ activeBot, tenantId, step2 }) {
  const router = useRouter()
  const [checks, setChecks] = useState({})
  const [loaded, setLoaded] = useState(false)
  const [counts, setCounts] = useState(null)

  useEffect(() => {
    try { setChecks(JSON.parse(localStorage.getItem(CHECK_KEY) || '{}')) } catch (_) { setChecks({}) }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) localStorage.setItem(CHECK_KEY, JSON.stringify(checks))
  }, [checks, loaded])

  // Etapa 3: contagem de contatos e produtos pós-conexão
  useEffect(() => {
    if (!activeBot || !tenantId) return
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
      .then(({ count }) => setCounts(c => ({ ...(c || {}), contacts: count ?? 0 })))
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('is_active', true)
      .then(({ count }) => setCounts(c => ({ ...(c || {}), products: count ?? 0 })))
  }, [activeBot, tenantId])

  const doneCount = ITEMS.filter(i => checks[i.id]).length
  const allDone = doneCount === ITEMS.length
  const step = activeBot ? 3 : (allDone ? 2 : 1)

  const toggle = (id) => setChecks(c => ({ ...c, [id]: !c[id] }))

  const stepHeader = (n, icon, title) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 130 }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0, fontSize: 13, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: step >= n ? 'linear-gradient(135deg, #4f8ef7, #06b6d4)' : 'rgba(255,255,255,0.05)',
        color: step >= n ? '#fff' : '#64748b',
        border: step >= n ? 'none' : '1px solid var(--border-soft, rgba(255,255,255,0.1))',
      }}>{step > n ? '✓' : n}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: step >= n ? 'var(--text-primary, #fff)' : '#64748b' }}>{icon} {title}</div>
      </div>
    </div>
  )

  return (
    <div className="ark-card" style={{ marginBottom: 20 }}>
      {/* Stepper */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        overflowX: 'auto',
      }}>
        {stepHeader(1, '🧳', 'Preparar')}
        <div style={{ height: 2, flex: 1, minWidth: 16, background: step >= 2 ? '#4f8ef7' : 'var(--border-soft, rgba(255,255,255,0.08))' }} />
        {stepHeader(2, '📲', 'Conectar')}
        <div style={{ height: 2, flex: 1, minWidth: 16, background: step >= 3 ? '#4f8ef7' : 'var(--border-soft, rgba(255,255,255,0.08))' }} />
        {stepHeader(3, '🚀', 'Importar')}
      </div>

      {/* ETAPA 1 — Preparar (sempre visível antes da conexão) */}
      {step !== 3 && (
        <div style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
              🧳 Etapa 1 — Prepare a migração <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>(sem risco de perder nada)</span>
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>{doneCount}/{ITEMS.length} concluídos</div>
          </div>

          <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 16 }}>
            <div style={{ height: '100%', width: `${(doneCount / ITEMS.length) * 100}%`, borderRadius: 4, background: 'linear-gradient(90deg, #4f8ef7, #10b981)', transition: 'width .3s' }} />
          </div>

          {ITEMS.map(item => (
            <label key={item.id} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer',
              padding: '11px 12px', borderRadius: 12, marginBottom: 6,
              background: checks[item.id] ? 'rgba(16,185,129,0.07)' : 'var(--bg-secondary, rgba(255,255,255,0.03))',
              border: `1px solid ${checks[item.id] ? 'rgba(16,185,129,0.3)' : 'var(--border-soft, rgba(255,255,255,0.06))'}`,
              transition: 'all .15s',
            }}>
              <input type="checkbox" checked={!!checks[item.id]} onChange={() => toggle(item.id)} style={{ marginTop: 2, accentColor: '#10b981', width: 16, height: 16, cursor: 'pointer' }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: checks[item.id] ? '#10b981' : 'var(--text-primary, #fff)', marginBottom: 2 }}>
                  {item.icon} {item.title} {checks[item.id] && '✓'}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted, #94a3b8)' }}>{item.desc}</div>
              </div>
            </label>
          ))}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11.5, color: '#64748b' }}>
              💡 Número de chip novo, nunca logado em nenhum WhatsApp? Pule direto pra Conexão.
            </div>
            <button type="button" onClick={() => {
              const c = {}; ITEMS.forEach(i => c[i.id] = true); setChecks(c)
            }} className="ark-btn" style={{ fontSize: 13 }}>
              Tudo pronto — ir pra Conexão →
            </button>
          </div>
        </div>
      )}

      {/* ETAPA 2 — Conectar (slot da página, sempre visível) */}
      {step !== 3 && (
        <div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '14px 18px 0',
            fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)',
          }}>📲 Etapa 2 — Conectar seu número</div>
          {!allDone && (
            <div style={{
              margin: '10px 18px 0', padding: '10px 12px',
              borderRadius: 10, fontSize: 12, lineHeight: 1.5, color: '#fbbf24',
              background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.3)',
            }}>
              ⚠️ Recomendo concluir a preparação acima antes de conectar (é o que garante que nada se perde). Chip novo, nunca logado em app? Pode seguir direto.
            </div>
          )}
          <div style={{ padding: '16px 18px' }}>{step2}</div>
        </div>
      )}

      {/* ETAPA 3 — Importar */}
      {step === 3 && (
        <div style={{ padding: '16px 18px' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary, #fff)', marginBottom: 6 }}>
            🚀 Etapa 3 — Traga seus dados pra plataforma
          </div>
          <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 14 }}>
            Número conectado! Agora recupere o que é seu: contatos e catálogo entram aqui, e suas conversas antigas seguem seguras no Google Drive.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary, rgba(255,255,255,0.04))', border: '1px solid var(--border-soft, rgba(255,255,255,0.06))' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>👥 Contatos na plataforma</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
                {counts?.contacts ?? '…'}
                {counts?.contacts > 0 && <span style={{ fontSize: 13, color: '#10b981', marginLeft: 8 }}>✓</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => router.push('/admin/contacts')} style={miniBtn}>Importar contatos</button>
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary, rgba(255,255,255,0.04))', border: '1px solid var(--border-soft, rgba(255,255,255,0.06))' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>📦 Produtos no catálogo</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>
                {counts?.products ?? '…'}
                {counts?.products > 0 && <span style={{ fontSize: 13, color: '#10b981', marginLeft: 8 }}>✓</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => router.push('/admin/products')} style={miniBtn}>Cadastrar produtos</button>
              </div>
            </div>

            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', marginBottom: 4 }}>☁️ Conversas antigas</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, color: '#10b981', fontWeight: 700 }}>Seguras no Google Drive ✓</div>
              <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 6, lineHeight: 1.5 }}>
                Backup feito na Etapa 1. Restauráveis no app a qualquer momento.
              </div>
            </div>
          </div>

          {counts && counts.contacts > 0 && counts.products > 0 && (
            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))', border: '1px solid rgba(16,185,129,0.35)', fontSize: 13, color: '#10b981', fontWeight: 700 }}>
              🎉 Migração completa: contatos e catálogo na plataforma, bot atendendo sozinho.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const miniBtn = {
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
  padding: '6px 12px', borderRadius: 8,
  border: '1px solid rgba(79,142,247,0.35)', background: 'rgba(79,142,247,0.1)',
  color: '#4f8ef7',
}
