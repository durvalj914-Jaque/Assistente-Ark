import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import HelpTip from './HelpTip'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = typeof window !== 'undefined' ? window.atob(base64) : ''
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

const EVENT_TYPES = [
  { key: 'human_handoff', label: 'Atendimento humano', icon: '👤', desc: 'Cliente pediu para falar com pessoa', defaultSound: 'urgent', defaultVibration: 'urgent', defaultEnabled: true },
  { key: 'no_bot_message', label: 'Mensagem de "Sem bot"', icon: '🔇', desc: 'Fornecedores, familiares ou contatos sem bot', defaultSound: 'gentle', defaultVibration: 'gentle', defaultEnabled: true },
  { key: 'new_order', label: 'Novo pedido', icon: '🛒', desc: 'Cliente enviou um carrinho de compras', defaultSound: 'normal', defaultVibration: 'normal', defaultEnabled: true },
  { key: 'receipt', label: 'Comprovante recebido', icon: '📄', desc: 'Cliente enviou comprovante de pagamento', defaultSound: 'normal', defaultVibration: 'normal', defaultEnabled: true },
  { key: 'loop_detected', label: 'Loop detectado', icon: '⏸️', desc: 'Bot pausado por mensagens em excesso', defaultSound: 'alert', defaultVibration: 'alert', defaultEnabled: true },
]

const VIBRATION_PATTERNS = {
  none: { label: 'Sem vibração', pattern: [] },
  gentle: { label: 'Suave', pattern: [100] },
  normal: { label: 'Normal', pattern: [200, 100, 200] },
  urgent: { label: 'Urgente', pattern: [300, 150, 300, 150, 300] },
  alert: { label: 'Alerta', pattern: [100, 50, 100, 50, 100, 50, 200] },
}

const SOUND_TYPES = {
  none: { label: 'Sem som', freq: null },
  gentle: { label: 'Suave (1 toque)', freq: 440, duration: 200, count: 1 },
  normal: { label: 'Normal (2 toques)', freq: 523, duration: 150, count: 2 },
  urgent: { label: 'Urgente (3 toques)', freq: 880, duration: 100, count: 3 },
  alert: { label: 'Alerta (repetido)', freq: 660, duration: 80, count: 4 },
}

function playSound(soundKey) {
  const sound = SOUND_TYPES[soundKey]
  if (!sound || !sound.freq) return
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < sound.count; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = sound.freq
      osc.type = 'sine'
      const start = ctx.currentTime + (i * (sound.duration + 100)) / 1000
      const end = start + sound.duration / 1000
      gain.gain.setValueAtTime(0.3, start)
      gain.gain.exponentialRampToValueAtTime(0.01, end)
      osc.start(start)
      osc.stop(end)
    }
    setTimeout(() => ctx.close(), (sound.count * (sound.duration + 100) + 200))
  } catch (_) {}
}

function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

const labelStyle = { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

export default function NotificationSettingsCard({ tenant }) {
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [settings, setSettings] = useState({})
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(false)

  const defaultSettings = {}
  EVENT_TYPES.forEach(t => {
    defaultSettings[t.key] = { enabled: t.defaultEnabled, sound: t.defaultSound, vibration: t.defaultVibration }
  })

  const checkSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setSupported(false)
      return
    }
    setPermission(Notification.permission)
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const sub = await reg.pushManager.getSubscription()
      setSubscribed(!!sub)
    } catch (e) {
      setSupported(false)
    }
  }, [])

  useEffect(() => {
    checkSubscription()
    try {
      const local = JSON.parse(localStorage.getItem('ark-notification-settings') || '{}')
      setSettings({ ...defaultSettings, ...local })
    } catch (_) {
      setSettings(defaultSettings)
    }
  }, [])

  useEffect(() => {
    if (tenant?.notification_settings) {
      setSettings(prev => ({ ...prev, ...tenant.notification_settings }))
    }
  }, [tenant])

  async function saveSettings() {
    setSaving(true)
    try {
      localStorage.setItem('ark-notification-settings', JSON.stringify(settings))
      if (tenant) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
          body: JSON.stringify({ settings }),
        })
      }
      setSavedAt(true)
      setTimeout(() => setSavedAt(false), 2500)
    } catch (e) {
      setMessage({ type: 'error', text: 'Erro ao salvar configurações.' })
    }
    setSaving(false)
  }

  function updateSetting(key, field, value) {
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function enable() {
    setLoading(true)
    setMessage(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setMessage({ type: 'error', text: 'Permissão negada — habilite notificações nas configurações do navegador.' })
        setLoading(false)
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) })
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error('Falha ao salvar inscrição')
      setSubscribed(true)
      setMessage({ type: 'success', text: 'Notificações ativadas! 🎉' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Não foi possível ativar.' })
    }
    setLoading(false)
  }

  async function disable() {
    setLoading(true)
    setMessage(null)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
      }
      setSubscribed(false)
      setMessage({ type: 'success', text: 'Notificações desativadas.' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setLoading(false)
  }

  async function sendTest() {
    playSound('urgent')
    vibrate(VIBRATION_PATTERNS.urgent.pattern)
    if (subscribed) {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ type: 'human_handoff' }),
        })
      } catch (_) {}
    }
  }

  return (
    <div className="ark-card" style={{ marginBottom: 20 }}>
      <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
        🔔 Notificações
        <HelpTip text="Ative as notificações neste dispositivo e personalize som e vibração por tipo de evento — atendimento humano, fornecedores, pedidos e mais." />
      </h3>
      <p style={{ color: 'var(--text-muted)', fontSize: 12.5, marginBottom: 16 }}>
        Personalize som e vibração por tipo de evento. O filtro de quais tipos enviar é salvo no servidor; som e vibração funcionam neste dispositivo.
      </p>

      {!supported ? (
        <p style={{ color: '#f59e0b', fontSize: 13 }}>Esse navegador não tem suporte a notificações push. Use Chrome/Edge no computador ou Chrome no Android.</p>
      ) : permission === 'denied' ? (
        <p style={{ color: '#ef4444', fontSize: 13 }}>Você bloqueou notificações pra esse site. Libere nas configurações do navegador/celular.</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
          {subscribed ? (
            <>
              <button onClick={sendTest} disabled={loading} className="ark-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
                🔔 Testar notificação
              </button>
              <button onClick={disable} disabled={loading} style={{ padding: '8px 14px', fontSize: 13, borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                Desativar neste dispositivo
              </button>
            </>
          ) : (
            <button onClick={enable} disabled={loading} className="ark-btn" style={{ padding: '8px 16px', fontSize: 13 }}>
              {loading ? 'Ativando…' : '🔔 Ativar notificações neste dispositivo'}
            </button>
          )}
        </div>
      )}

      {/* Per-event-type settings */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
        {EVENT_TYPES.map(evt => {
          const s = settings[evt.key] || { enabled: evt.defaultEnabled, sound: evt.defaultSound, vibration: evt.defaultVibration }
          return (
            <div key={evt.key} style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 14, border: '1px solid var(--border-soft)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{evt.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{evt.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{evt.desc}</div>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={e => updateSetting(evt.key, 'enabled', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: '#4f8ef7', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {s.enabled && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginTop: 10, alignItems: 'end' }}>
                  <div>
                    <label style={labelStyle}>SOM</label>
                    <select value={s.sound} onChange={e => updateSetting(evt.key, 'sound', e.target.value)} className="ark-input" style={{ padding: '6px 8px', fontSize: 12 }}>
                      {Object.entries(SOUND_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>VIBRAÇÃO</label>
                    <select value={s.vibration} onChange={e => updateSetting(evt.key, 'vibration', e.target.value)} className="ark-input" style={{ padding: '6px 8px', fontSize: 12 }}>
                      {Object.entries(VIBRATION_PATTERNS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <button
                    onClick={() => { playSound(s.sound); vibrate((VIBRATION_PATTERNS[s.vibration] || {}).pattern || []) }}
                    style={{ padding: '6px 10px', fontSize: 11, borderRadius: 6, border: '1px solid var(--border-soft)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >
                    ▶ Testar
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
        <button onClick={saveSettings} disabled={saving} className="ark-btn" style={{ padding: '8px 18px', fontSize: 13 }}>
          {saving ? 'Salvando…' : savedAt ? '✅ Salvo!' : '💾 Salvar configurações'}
        </button>
      </div>

      {message && (
        <p style={{ color: message.type === 'error' ? '#ef4444' : '#10b981', fontSize: 12, marginTop: 12 }}>{message.text}</p>
      )}
    </div>
  )
}
