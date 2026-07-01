import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import ErrorBoundary from '../components/ErrorBoundary'

const PUBLIC_PAGES = ['/', '/login', '/termos', '/privacidade', '/cookies']

export default function App({ Component, pageProps }) {
  const router = useRouter()

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        if (router.pathname === '/login') {
          router.replace('/admin')
        }
      }
      if (event === 'SIGNED_OUT') {
        if (!PUBLIC_PAGES.includes(router.pathname)) {
          router.replace('/login')
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [router])

  useEffect(() => {
    const handle = () => window.scrollTo(0, 0)
    router.events.on('routeChangeComplete', handle)
    return () => router.events.off('routeChangeComplete', handle)
  }, [router.events])

  const canonicalUrl = 'https://arkiel.com.br' + router.pathname

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet" />
        <title>Arkiel — Automação Inteligente para WhatsApp Business</title>
        <meta name="description" content="Plataforma SaaS para chatbots WhatsApp com IA. Multi-tenant, sem código, escalável." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Arkiel — Automação Inteligente" />
        <meta property="og:description" content="Automatize seu atendimento WhatsApp com inteligência artificial." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://arkiel.com.br/arkiel-logo.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#000000" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  )
}
