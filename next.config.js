/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: { domains: ['lh3.googleusercontent.com'] },
  async redirects() {
    // LGPD: /termos e /privacidade agora são páginas próprias deste projeto (pages/termos.js e pages/privacidade.js)
    return []
  },
}
