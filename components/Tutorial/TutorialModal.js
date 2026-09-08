import { useEffect } from 'react'

/**
 * Tutorial contextual da aba: o que dá pra fazer ali, como configurar e um
 * exemplo real ilustrado (mockup de conversa estilo WhatsApp).
 */
export default function TutorialModal({ tutorial, onClose }) {
  useEffect(() => {
    function onEsc(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onEsc)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onEsc); document.body.style.overflow = '' }
  }, [onClose])

  if (!tutorial) return null

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 999,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      '@media (min-width: 640px)': { alignItems: 'center' },
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 620, maxHeight: '92dvh', overflowY: 'auto',
        background: 'var(--bg-card, #12121f)', borderRadius: '20px 20px 0 0',
        border: '1px solid var(--border-medium, rgba(255,255,255,0.08))',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        fontFamily: 'Inter, sans-serif',
      }}>
        {/* Header */}
        <div style={{
          position: 'sticky', top: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '18px 20px 14px',
          background: 'var(--bg-card, #12121f)',
          borderBottom: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: 'linear-gradient(135deg, rgba(79,142,247,0.2), rgba(6,182,212,0.12))',
            border: '1px solid rgba(79,142,247,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>{tutorial.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#4f8ef7', letterSpacing: 0.5 }}>TUTORIAL DA ABA</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary, #fff)' }}>{tutorial.title}</div>
          </div>
          <button onClick={onClose} aria-label="Fechar" style={{
            width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border-soft, rgba(255,255,255,0.1))',
            background: 'var(--bg-secondary, rgba(255,255,255,0.05))', color: 'var(--text-secondary, #94a3b8)',
            fontSize: 16, cursor: 'pointer', flexShrink: 0,
          }}>✕</button>
        </div>

        <div style={{ padding: '18px 20px 24px' }}>
          {/* Pra que serve */}
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text-primary, #e2e8f0)', margin: '0 0 20px' }}>
            {tutorial.purpose}
          </p>

          {/* O que dá pra fazer */}
          <SectionTitle>🛠️ O que você consegue fazer aqui</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 8 }}>
            {tutorial.features.map((f, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, alignItems: 'flex-start',
                padding: 12, borderRadius: 12,
                background: 'var(--bg-secondary, rgba(255,255,255,0.04))',
                border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
              }}>
                <span style={{ fontSize: 18, lineHeight: 1.2, flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted, #94a3b8)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Passo a passo */}
          <SectionTitle>📋 Como configurar — passo a passo</SectionTitle>
          <div style={{ position: 'relative', paddingLeft: 22 }}>
            <div style={{
              position: 'absolute', left: 10, top: 10, bottom: 10, width: 2,
              background: 'linear-gradient(180deg, #4f8ef7, #06b6d4)', borderRadius: 2, opacity: 0.45,
            }} />
            {tutorial.steps.map((s, i) => (
              <div key={i} style={{ position: 'relative', padding: '0 0 16px' }}>
                <div style={{
                  position: 'absolute', left: -22, top: 0,
                  width: 22, height: 22, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4f8ef7, #06b6d4)',
                  color: '#fff', fontSize: 11, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 2 }}>{s.title}</div>
                <div style={{ fontSize: 12, lineHeight: 1.55, color: 'var(--text-muted, #94a3b8)' }}>{s.desc}</div>
              </div>
            ))}
          </div>

          {/* Exemplo real ilustrado */}
          <SectionTitle>💬 Exemplo da vida real</SectionTitle>
          <div style={{
            padding: 14, borderRadius: 14,
            background: 'var(--bg-secondary, rgba(255,255,255,0.03))',
            border: '1px solid var(--border-soft, rgba(255,255,255,0.06))',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', marginBottom: 10 }}>
              {tutorial.example.story}
            </div>
            {/* Mockup de conversa estilo WhatsApp */}
            <div style={{
              borderRadius: 12, padding: '12px 10px',
              background: '#0b141a',
              backgroundImage: 'radial-gradient(rgba(79,142,247,0.06) 1px, transparent 1px)',
              backgroundSize: '14px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              {tutorial.example.chat.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.from === 'client' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%', padding: '8px 12px',
                  borderRadius: m.from === 'client' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.from === 'client' ? '#005c4b' : '#1f2c33',
                  color: '#e9edef', fontSize: 12.5, lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
                }}>
                  {m.from === 'client' ? '' : '🤖 '}{m.text}
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-muted, #94a3b8)', marginTop: 10 }}>
              {tutorial.example.after}
            </div>
          </div>

          {/* Dica de ouro */}
          <div style={{
            marginTop: 16, display: 'flex', gap: 10, alignItems: 'flex-start',
            padding: '12px 14px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05))',
            border: '1px solid rgba(245,158,11,0.3)',
          }}>
            <span style={{ fontSize: 16 }}>💡</span>
            <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-primary, #e2e8f0)' }}>
              <b>Dica de ouro:</b> {tutorial.tip}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 12, fontWeight: 800, letterSpacing: 0.4,
      color: '#4f8ef7', margin: '22px 0 10px',
    }}>{children}</div>
  )
}
