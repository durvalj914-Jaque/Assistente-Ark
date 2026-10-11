// ── Criptografia AES-256-GCM para chaves de IA dos tenants ────────────────
// A chave API do B2B nunca vai em texto plano pro banco: é cifrada aqui com
// AI_ENC_SECRET (env da Vercel) e só o service role decifra no momento da
// chamada ao provedor. O frontend nunca recebe a chave de volta.

import crypto from 'crypto'

function getKey() {
  const secret = process.env.AI_ENC_SECRET
  if (!secret) throw new Error('AI_ENC_SECRET não configurada no servidor')
  // Deriva uma chave estável de 32 bytes do segredo (aceita qualquer tamanho)
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(plain) {
  if (!plain) return null
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // formato: v1.<iv>.<tag>.<ciphertext> — tudo em base64url
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), enc.toString('base64url')].join('.')
}

export function decryptSecret(payload) {
  if (!payload) return null
  const parts = String(payload).split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') return null
  try {
    const iv = Buffer.from(parts[1], 'base64url')
    const tag = Buffer.from(parts[2], 'base64url')
    const enc = Buffer.from(parts[3], 'base64url')
    const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
  } catch (_) {
    return null
  }
}

// Gera um segredo novo (usado uma vez pra configurar a env no Vercel)
export function generateSecret() {
  return crypto.randomBytes(32).toString('base64url')
}
