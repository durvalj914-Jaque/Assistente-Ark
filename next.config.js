/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: { domains: ['lh3.googleusercontent.com'] },
  async redirects() {
    return [
      {
        source: '/termos',
        destination: 'https://www.arkiel.com.br/termos',
        permanent: false,
      },
      {
        source: '/privacidade',
        destination: 'https://www.arkiel.com.br/privacidade',
        permanent: false,
      },
      {
        source: '/cookies',
        destination: 'https://www.arkiel.com.br/cookies',
        permanent: false,
      },
    ]
  },
}
