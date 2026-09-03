/**
 * Gerador de PIX BR Code (EMV-QRCPS)
 * Gera o código copia/cola compatível com todos os bancos brasileiros
 */

// CRC16-CCITT (polinômio 0x1021) - exigido pelo BR Code
function crc16(payload) {
  let crc = 0xFFFF
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1
      crc &= 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// TLV: ID + tamanho (2 dígitos) + valor
function tlv(id, value) {
  const byteLen = Buffer.byteLength(value, 'utf8')
  const len = byteLen.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/**
 * Sanitiza texto: uppercase, sem acentos, sem caracteres especiais
 * Apenas A-Z, 0-9, - e espaço (exigido pelo BR Code para nomes e cidades)
 */
function sanitize(str) {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')   // remove acentos
    .replace(/[^A-Z0-9 -]/g, '')       // apenas alfanumérico, hífen e espaço
    .trim()
}

/**
 * Gera o código PIX (copia e cola) compatível com todos os bancos
 * @param {Object} opts
 * @param {string} opts.pixKey - Chave PIX (CPF, email, telefone, aleatória)
 * @param {string} opts.merchantName - Nome do recebedor (máx 25 chars)
 * @param {string} opts.merchantCity - Cidade do recebedor (máx 15 chars)
 * @param {number} opts.amount - Valor (ex: 29.90)
 * @param {string} [opts.txid] - ID da transação (default: ***)
 * @param {string} [opts.description] - Descrição (ignorada — alguns bancos rejeitam)
 */
function generatePixCode({ pixKey, merchantName, merchantCity, amount, txid = '***', description }) {
  // Sanitizar nome e cidade (regras do BACEN)
  const name = sanitize(merchantName).substring(0, 25) || 'RECEBEDOR'
  const city = sanitize(merchantCity).substring(0, 15) || 'SAO PAULO'

  // Formatar valor sempre com 2 casas decimais
  const amountStr = amount.toFixed(2)

  // Normalizar chave PIX
  let normalizedKey = pixKey.trim()
  // Auto-formatar telefone: add +55 se for apenas dígitos
  if (/^\d+$/.test(normalizedKey) && normalizedKey.length >= 10 && normalizedKey.length <= 13) {
    normalizedKey = '+55' + normalizedKey
  }

  // Merchant Account Info (ID 26) — apenas GUI + chave
  // Sub-ID 02 (descrição) REMOVIDO: muitos bancos rejeitam ou truncam
  const gui = tlv('00', 'br.gov.bcb.pix')
  const key = tlv('01', normalizedKey)
  const merchantInfo = tlv('26', gui + key)

  // TXID sanitizado (apenas alfanumérico, máx 25 chars)
  const cleanTxid = (txid || '***').replace(/[^A-Z0-9]/gi, '').substring(0, 25) || '***'

  // Construir payload sem ID 01 (POS Method) — é opcional e
  // alguns bancos têm bugs na leitura quando presente
  const payload = [
    tlv('00', '01'),                                  // Payload Format Indicator
    merchantInfo,                                     // Merchant Account Info
    tlv('52', '0000'),                                // Merchant Category Code
    tlv('53', '986'),                                 // Transaction Currency (986 = BRL)
    tlv('54', amountStr),                             // Transaction Amount
    tlv('58', 'BR'),                                  // Country Code
    tlv('59', name),                                  // Merchant Name
    tlv('60', city),                                  // Merchant City
    tlv('62', tlv('05', cleanTxid)),                  // Additional Data (TXID)
  ].join('')

  // Adicionar CRC
  const payloadWithCRC = payload + '6304'
  const crc = crc16(payloadWithCRC)
  return payloadWithCRC + crc
}

module.exports = { generatePixCode }
