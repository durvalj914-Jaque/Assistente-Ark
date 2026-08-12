/**
 * Gerador de PIX BR Code (EMV-QRCPS)
 * Gera o código copia/cola e o payload para QR Code
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

// TLV: ID + tamanho + valor
function tlv(id, value) {
  const byteLen = Buffer.byteLength(value, 'utf8')
  const len = byteLen.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

/**
 * Gera o código PIX (copia e cola)
 * @param {Object} opts
 * @param {string} opts.pixKey - Chave PIX (CPF, email, telefone, aleatória)
 * @param {string} opts.merchantName - Nome do recebedor (máx 25 chars)
 * @param {string} opts.merchantCity - Cidade do recebedor (máx 15 chars)
 * @param {number} opts.amount - Valor (ex: 29.90)
 * @param {string} [opts.txid] - ID da transação (default: ***)
 * @param {string} [opts.description] - Descrição (opcional)
 */
function generatePixCode({ pixKey, merchantName, merchantCity, amount, txid = '***', description }) {
  // Sanitizar
  const name = merchantName.substring(0, 25).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const city = merchantCity.substring(0, 15).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const amountStr = amount.toFixed(2)

  // Merchant Account Info (ID 26)
  const gui = tlv('00', 'br.gov.bcb.pix')          // GUI
  const cleanKey = pixKey.replace(/[.\-\s()]/g, '')  // Remove formatacao
  const key = tlv('01', cleanKey)                      // Chave PIX
  const desc = description ? tlv('02', description.substring(0, 50).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) : ''
  const merchantInfo = tlv('26', gui + key + desc)

  // Construir payload
  const payload = [
    tlv('00', '01'),                                  // Payload Format Indicator
    tlv('01', '11'),                                  // Point of Sale Method (12 = dinâmico)
    merchantInfo,                                     // Merchant Account Info
    tlv('52', '0000'),                                // Merchant Category Code
    tlv('53', '986'),                                 // Transaction Currency (986 = BRL)
    tlv('54', amountStr),                             // Transaction Amount
    tlv('58', 'BR'),                                  // Country Code
    tlv('59', name),                                  // Merchant Name
    tlv('60', city),                                  // Merchant City
    tlv('62', tlv('05', txid.substring(0, 25))),      // Additional Data (TXID)
  ].join('')

  // Adicionar CRC
  const payloadWithCRC = payload + '6304'
  const crc = crc16(payloadWithCRC)
  return payloadWithCRC + crc
}

module.exports = { generatePixCode }
