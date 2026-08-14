import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'

const PUBLIC_PAGES = ['/', '/login', '/assistente-ark', '/assistente-ark/entrar', '/termos', '/privacidade', '/cookies']

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (router.pathname === '/login' || router.pathname === '/assistente-ark' || router.pathname === '/assistente-ark/entrar') {
          router.replace('/painel')
        }
      }
      if (event === 'SIGNED_OUT') {
        if (!PUBLIC_PAGES.includes(router.pathname)) {
          router.replace('/assistente-ark/entrar')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  // ── Tocar som quando receber push do service worker ──
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return

    const SOUND_PROFILES = {
      none: { freq: null },
      gentle: { freq: 440, duration: 200, count: 1 },
      normal: { freq: 523, duration: 150, count: 2 },
      urgent: { freq: 880, duration: 100, count: 3 },
      alert: { freq: 660, duration: 80, count: 4 },
    }

    const TYPE_TO_SOUND = {
      human_handoff: 'urgent',
      no_bot_message: 'gentle',
      new_order: 'normal',
      receipt: 'normal',
      loop_detected: 'alert',
    }

    function playNotificationSound(soundKey) {
      const sound = SOUND_PROFILES[soundKey]
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
        setTimeout(() => ctx.close(), 500)
      } catch (_) {}
    }

    function onSWMessage(event) {
      if (event.data?.type === 'NOTIFICATION_RECEIVED') {
        const eventType = event.data.eventType
        // Ler configuração de som do localStorage
        try {
          const settings = JSON.parse(localStorage.getItem('ark-notification-settings') || '{}')
          const eventSetting = settings[eventType] || {}
          if (eventSetting.enabled === false) return
          playNotificationSound(eventSetting.sound || TYPE_TO_SOUND[eventType] || 'normal')
        } catch (_) {
          playNotificationSound(TYPE_TO_SOUND[eventType] || 'normal')
        }
      }
    }

    navigator.serviceWorker.addEventListener('message', onSWMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onSWMessage)
  }, [])

  useEffect(() => {
    const handle = () => window.scrollTo(0, 0)
    router.events.on('routeChangeComplete', handle)
    return () => router.events.off('routeChangeComplete', handle)
  }, [router.events])

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  // Aplicar tema salvo
  useEffect(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('ark-theme') || 'dark' : 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  const canonicalUrl = 'https://arkiel.com.br' + router.pathname

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <meta name="description" content="Arkiel — Soluções em IA e automação para WhatsApp Business e indústria." />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta property="og:title" content="Arkiel — Tecnologia Inteligente" />
        <meta property="og:description" content="Automatize seu atendimento WhatsApp com inteligência artificial." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://arkiel.com.br/assistente-ark-logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#000000" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  )
}
