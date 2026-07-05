import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const META_APP_ID = process.env.NEXT_PUBLIC_META_APP_ID || '1233523595601487'
const CONFIG_ID = process.env.NEXT_PUBLIC_WHATSAPP_CONFIG_ID

/**
 * Botão "Conectar com Facebook" — Embedded Signup oficial da Meta.
 * Ao clicar, abre o popup de login do Facebook; o cliente escolhe/cria a
 * conta WhatsApp Business dele, e nós recebemos automaticamente o code +
 * waba_id + phone_number_id, mandamos pro backend, e pronto — sem token
 * manual, sem espera pela equipe Arkiel.
 */
export default function WhatsAppEmbeddedSignup({ botId, onConnected }) {
  const [sdkReady, setSdkReady] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState('')
  const sessionInfo = useRef({})

  useEffect(() => {
    if (window.FB) { setSdkReady(true); return }
    window.fbAsyncInit = function () {
      window.FB.init({ appId: META_APP_ID, cookie: true, xfbml: false, version: 'v20.0' })
      setSdkReady(true)
    }
    const script = document.createElement('script')
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    function handleMessage(event) {
      if (!event.origin.endsWith('facebook.com')) return
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          sessionInfo.current = {
            waba_id: data.data?.waba_id,
            phone_number_id: data.data?.phone_number_id
          }
        }
      } catch (_) { /* mensagens de outra origem/formato, ignora */ }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleConnect() {
    setError('')
    if (!CONFIG_ID) { setError('Configuração do Embedded Signup ainda não finalizada. Fale com a equipe Arkiel.'); return }
    if (!sdkReady || !window.FB) { setError('Ainda carregando o Facebook, tente de novo em instantes.'); return }

    setConnecting(true)
    window.FB.login((response) => {
      const code = response?.authResponse?.code
      const { waba_id, phone_number_id } = sessionInfo.current

      if (!code || !waba_id || !phone_number_id) {
        setConnecting(false)
        setError('Conexão cancelada ou incompleta. Tente novamente e conclua todas as etapas do popup.')
        return
      }
      finish(code, waba_id, phone_number_id)
    }, {
      config_id: CONFIG_ID,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, featureType: 'whatsapp_business_app_onboarding', sessionInfoVersion: 2 }
    })
  }

  async function finish(code, waba_id, phone_number_id) {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ bot_id: botId, code, waba_id, phone_number_id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Falha ao conectar')
      onConnected && onConnected()
    } catch (err) {
      setError(err.message)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleConnect} disabled={connecting} className="ark-btn"
        style={{ background: '#1877F2', display: 'flex', alignItems: 'center', gap: 8 }}>
        {connecting ? 'Conectando...' : '📶 Conectar com Facebook'}
      </button>
      <p style={{ color: '#334155', fontSize: 11, marginTop: 8 }}>
        Vai abrir um popup do Facebook — escolha ou crie sua conta WhatsApp Business e sua conexão fica pronta na hora.
      </p>
      {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>{error}</p>}
    </div>
  )
}
