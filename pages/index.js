import AssistenteArkLanding from '../components/AssistenteArkLanding'

// Raiz consciente do host:
// - assistente-ark.com.br (e www) → site oficial do Assistente Ark (landing do produto)
// - qualquer outro host (arkiel.com.br) → site institucional Arkiel
export async function getServerSideProps({ req }) {
  const host = (req.headers.host || '').toLowerCase()
  const isAssistenteArkDomain =
    host.startsWith('assistente-ark.com.br') ||
    host.startsWith('www.assistente-ark.com.br') ||
    host.startsWith('assistente-ark.vercel.app')

  if (!isAssistenteArkDomain) {
    return {
      redirect: {
        destination: 'https://www.arkiel.com.br',
        permanent: false,
      },
    }
  }

  return { props: {} }
}

export default function Home() {
  return <AssistenteArkLanding siteUrl="https://www.arkiel.com.br" />
}
