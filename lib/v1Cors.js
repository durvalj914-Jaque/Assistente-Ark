/**
 * lib/v1Cors.js
 *
 * Wrapper de CORS para os endpoints públicos v1 (ark_live_...) usados pelo
 * app mobile Ark Mobile (Base44). Libera OPTIONS preflight e injeta os
 * headers de CORS em todas as respostas.
 *
 * Uso: export default withCors(handler)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Api-Key',
  'Access-Control-Max-Age': '86400',
}

export function withCors(handler) {
  return async function corsHandler(req, res) {
    // Preflight
    if (req.method === 'OPTIONS') {
      Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
      return res.status(204).end()
    }
    // Resposta normal — injeta CORS antes do handler escrever o body
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    return handler(req, res)
  }
}
