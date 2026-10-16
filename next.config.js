/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  images: { domains: ['lh3.googleusercontent.com'] },
  async redirects() {
    // LGPD: /termos e /privacidade agora são páginas próprias deste projeto (pages/termos.js e pages/privacidade.js)
    return []
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' data: blob: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'" },
      ],
    }]
  },
}
