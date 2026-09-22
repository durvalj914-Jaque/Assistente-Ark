/**
 * CORS para os endpoints públicos /api/v1/* (autenticados por API key ark_live).
 * Usados pelo app Ark Mobile (Base44) e integrações de terceiros.
 */
export const V1_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-api-key',
}

export function withCors(handler) {
  return async (req, res) => {
    Object.entries(V1_CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v))
    if (req.method === 'OPTIONS') return res.status(204).end()
    return handler(req, res)
  }
}
