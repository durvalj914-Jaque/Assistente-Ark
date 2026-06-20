import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

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
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
        <title>Assistente Ark — Chatbot WhatsApp SaaS</title>
        <meta name="description" content="Plataforma SaaS para criação e gestão de chatbots WhatsApp. Multi-tenant, sem código, escalável." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="Assistente Ark" />
        <meta property="og:description" content="Automatize seu WhatsApp com inteligência." />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://arkiel.com.br/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="theme-color" content="#080810" />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
