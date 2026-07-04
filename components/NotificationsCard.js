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

const labelStyle = { color: '#64748b', fontSize: 11, fontWeight: 700, letterSpacing: 1, display: 'block', marginBottom: 5 }

export default function NotificationsCard() {
  const [supported, setSupported] = useState(true)
  const [permission, setPermission] = useState('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)

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

  useEffect(() => { checkSubscription() }, [checkSubscription])

  async function enable() {
    setLoading(true)
    setMessage(null)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm)
      if (perm !== 'granted') {
        setMessage({ type: 'error', text: 'Permissão negada — habilite notificações nas configurações do navegador/celular pra esse site.' })
        setLoading(false)
        return
      }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      })

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
      if (!res.ok) throw new Error('Falha ao salvar inscrição')

      setSubscribed(true)
      setMessage({ type: 'success', text: 'Notificações ativadas neste dispositivo! 🎉' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message || 'Não foi possível ativar as notificações.' })
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
      setMessage({ type: 'success', text: 'Notificações desativadas neste dispositivo.' })
    } catch (e) {
      setMessage({ type: 'error', text: e.message })
    }
    setLoading(false)
  }

  async function sendTest() {
    setLoading(true)
    setMessage(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      await fetch('/api/push/test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      setMessage({ type: 'success', text: 'Teste enviado! Deve chegar em alguns segundos.' })
    } catch (e) {
      setMessage({ type: 'error', text: 'Falha ao enviar teste.' })
    }
    setLoading(false)
  }

  return (
    <div className="ark-card" style={{ marginBottom: 20 }}>
      <h3 style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
        🔔 Notificações
        <HelpTip text="Ative pra receber um alerta com som e vibração neste dispositivo sempre que um cliente pedir atendimento humano no WhatsApp. Funciona por navegador — ative em cada celular/computador que quiser avisar." />
      </h3>
      <p style={{ color: '#475569', fontSize: 12.5, marginBottom: 16 }}>
        Avisa você na hora, com som e vibração, quando um cliente digitar "humano" e precisar de atendimento.
      </p>

      {!supported ? (
        <p style={{ color: '#f59e0b', fontSize: 13 }}>Esse navegador não tem suporte a notificações push. Tente pelo Chrome/Edge no computador ou pelo Chrome no Android.</p>
      ) : permission === 'denied' ? (
        <p style={{ color: '#ef4444', fontSize: 13 }}>Você bloqueou notificações pra esse site. Pra ativar, libere nas configurações do navegador/celular.</p>
      ) : (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {subscribed ? (
            <>
              <button onClick={sendTest} disabled={loading} className="ark-btn-ghost" style={{ padding: '8px 14px', fontSize: 13 }}>
                {loading ? '…' : '🔔 Testar notificação'}
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

      {message && (
        <p style={{ color: message.type === 'error' ? '#ef4444' : '#10b981', fontSize: 12, marginTop: 12 }}>{message.text}</p>
      )}
    </div>
  )
}
