import '../styles/globals.css'
import Head from 'next/head'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function App({ Component, pageProps }) {
  const router = useRouter()

  // Scroll to top on route change
  useEffect(() => {
    const handle = () => window.scrollTo(0, 0)
    router.events.on('routeChangeComplete', handle)
    return () => router.events.off('routeChangeComplete', handle)
  }, [router.events])

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
        <meta name="theme-color" content="#080810" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🤖</text></svg>" />
      </Head>
      <Component {...pageProps} />
    </>
  )
}
