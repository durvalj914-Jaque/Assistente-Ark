// ── TOTP (RFC 6238) em Node puro (crypto), sem dependências ──
// Gera e valida códigos de 6 dígitos compatíveis com Google Authenticator,
// Microsoft Authenticator, 1Password, Authy etc.
import crypto from 'crypto'

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0, value = 0
  const out = []
  for (const c of clean) {
    value = (value << 5) | B32.indexOf(c)
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

// Segredo aleatório de 160 bits (padrão do Google Authenticator)
export function generateSecret() {
  return base32Encode(crypto.randomBytes(20))
}

function hotp(secretBuf, counter, digits = 6) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', secretBuf).update(msg).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 10 ** digits
  return String(code).padStart(digits, '0')
}

export function totpAt(secret, timestampSec, step = 30) {
  return hotp(base32Decode(secret), Math.floor(timestampSec / step))
}

// Valida aceitando 1 passo antes/depois (tolerância de ±30s de desvio de relógio)
export function verifyTotp(secret, code, window = 1) {
  if (!secret || !code || !/^\d{6}$/.test(String(code))) return false
  const t = Math.floor(Date.now() / 1000)
  for (let i = -window; i <= window; i++) {
    if (totpAt(secret, t + i * 30) === String(code)) return true
  }
  return false
}
