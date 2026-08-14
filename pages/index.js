// This page redirects to the institutional site
export async function getServerSideProps() {
  return {
    redirect: {
      destination: 'https://www.arkiel.com.br',
      permanent: false,
    }
  }
}

export default function Home() {
  return null
}
