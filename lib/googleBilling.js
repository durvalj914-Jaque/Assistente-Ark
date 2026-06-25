/**
 * Verificação de compras Google Play (server-side)
 * Usa a Google Play Developer API via service account
 */

const GOOGLE_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3'

/**
 * Obtém um access token via service account (JWT)
 */
async function getGoogleAccessToken() {
  const sa = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}')
  if (!sa.private_key) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON não configurada')

  const now   = Math.floor(Date.now() / 1000)
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }

  // Codifica JWT manualmente (sem lib externa)
  const header  = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url')
  const unsigned = `${header}.${payload}`

  const { createSign } = await import('crypto')
  const sign = createSign('RSA-SHA256')
  sign.update(unsigned)
  const signature = sign.sign(sa.private_key, 'base64url')
  const jwt = `${unsigned}.${signature}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })
  const data = await resp.json()
  if (!data.access_token) throw new Error('Falha ao obter token Google: ' + JSON.stringify(data))
  return data.access_token
}

/**
 * Verifica uma assinatura (subscription) no Google Play
 */
export async function verifyGoogleSubscription(packageName, productId, purchaseToken) {
  const token = await getGoogleAccessToken()
  const url = `${GOOGLE_API_BASE}/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Google Play API error ${resp.status}: ${err}`)
  }
  return resp.json()
}

/**
 * Verifica uma compra avulsa (in-app product)
 */
export async function verifyGoogleProduct(packageName, productId, purchaseToken) {
  const token = await getGoogleAccessToken()
  const url = `${GOOGLE_API_BASE}/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Google Play API error ${resp.status}: ${err}`)
  }
  return resp.json()
}

/**
 * Verifica se a assinatura está ativa
 * paymentState: 0=pendente, 1=ativa, 2=trial, 3=pendente diferido
 * cancelReason: se presente, foi cancelada
 */
export function isSubscriptionActive(subscriptionData) {
  if (!subscriptionData) return false
  const expiry = parseInt(subscriptionData.expiryTimeMillis || '0')
  const now    = Date.now()
  const active = (subscriptionData.paymentState === 1 || subscriptionData.paymentState === 2)
              && expiry > now
  return active
}
