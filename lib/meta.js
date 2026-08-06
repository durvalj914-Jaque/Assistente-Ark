import axios from 'axios'

const BASE = 'https://graph.facebook.com/v19.0'

function headers(token) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function sendText(phoneId, token, to, text) {
  return axios.post(`${BASE}/${phoneId}/messages`, {
    messaging_product: 'whatsapp', to,
    type: 'text', text: { body: text }
  }, { headers: headers(token) })
}

export async function sendButtons(phoneId, token, to, body, buttons) {
  return axios.post(`${BASE}/${phoneId}/messages`, {
    messaging_product: 'whatsapp', to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.slice(0,3).map((b,i) => ({
          type: 'reply',
          reply: { id: b.id || `btn_${i}`, title: b.title.substring(0,20) }
        }))
      }
    }
  }, { headers: headers(token) })
}

export async function sendList(phoneId, token, to, body, sections) {
  return axios.post(`${BASE}/${phoneId}/messages`, {
    messaging_product: 'whatsapp', to,
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: body },
      action: { button: 'Ver opções', sections }
    }
  }, { headers: headers(token) })
}

export async function markRead(phoneId, token, messageId) {
  return axios.post(`${BASE}/${phoneId}/messages`, {
    messaging_product: 'whatsapp',
    status: 'read',
    message_id: messageId
  }, { headers: headers(token) })
}

/**
 * Busca o perfil de negócio do WhatsApp (inclui a URL da foto de perfil atual).
 */
export async function getBusinessProfile(phoneId, token) {
  return axios.get(`${BASE}/${phoneId}/whatsapp_business_profile`, {
    params: { fields: 'profile_picture_url,about,description,email,websites,vertical,address' },
    headers: { Authorization: `Bearer ${token}` }
  })
}

/**
 * Troca a foto de perfil do WhatsApp Business.
 * Segue o fluxo oficial de "Resumable Upload API" da Meta:
 *   1) cria uma sessão de upload em /{app-id}/uploads
 *   2) envia os bytes do arquivo pra sessão -> recebe um "handle"
 *   3) usa o handle pra atualizar /{phone-number-id}/whatsapp_business_profile
 */
export async function updateProfilePhoto(phoneId, token, appId, fileBuffer, mimeType) {
  const sessionRes = await axios.post(`${BASE}/${appId}/uploads`, null, {
    params: { file_length: fileBuffer.length, file_type: mimeType, access_token: token }
  })
  const uploadSessionId = sessionRes.data.id
  if (!uploadSessionId) throw new Error('Não foi possível iniciar a sessão de upload na Meta')

  const uploadRes = await axios.post(`${BASE}/${uploadSessionId}`, fileBuffer, {
    headers: {
      Authorization: `OAuth ${token}`,
      file_offset: '0',
      'Content-Type': 'application/octet-stream'
    }
  })
  const handle = uploadRes.data.h
  if (!handle) throw new Error('Upload da imagem não retornou um handle válido')

  return axios.post(`${BASE}/${phoneId}/whatsapp_business_profile`, {
    messaging_product: 'whatsapp',
    profile_picture_handle: handle
  }, { headers: headers(token) })
}

/**
 * ===== Embedded Signup (onboarding automático de WhatsApp) =====
 * Fluxo oficial da Meta pra Tech Providers: o cliente loga com o Facebook
 * dele num popup, escolhe/cria a conta WhatsApp Business, e a Meta devolve
 * um "code" de curta duração pro frontend. Essas funções trocam esse code
 * por um token de acesso e finalizam a conexão do número — tudo automático,
 * sem a equipe Arkiel precisar copiar/colar token manualmente.
 */
const GRAPH_APP_BASE = 'https://graph.facebook.com/v20.0'

/**
 * Troca o "code" do Embedded Signup por um token de acesso de curta duração,
 * e em seguida troca esse token por um de longa duração (~60 dias, e não
 * expira enquanto o app tiver uso ativo — é o mesmo tipo de token usado
 * hoje manualmente nos bots).
 */
export async function exchangeCodeForLongLivedToken(code, appId, appSecret) {
  const shortRes = await axios.get(`${GRAPH_APP_BASE}/oauth/access_token`, {
    params: { client_id: appId, client_secret: appSecret, code }
  })
  const shortToken = shortRes.data.access_token
  if (!shortToken) throw new Error('Meta não retornou um access_token pro code informado')

  const longRes = await axios.get(`${GRAPH_APP_BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken
    }
  })
  return longRes.data.access_token || shortToken
}

/**
 * Registra o número na Cloud API (obrigatório antes de enviar mensagens).
 * Usa um PIN fixo e conhecido da Arkiel pra todos os números — evita erros
 * de "PIN Mismatch" quando o número já foi registrado anteriormente e depois
 * desregistrado (ex.: migração de provedor, reset de teste, etc.).
 *
 * Fluxo resiliente:
 *   1. Tenta registrar com o PIN padrão da Arkiel.
 *   2. Se der "PIN Mismatch" (número já tinha um PIN diferente), tenta
 *      desregistrar primeiro e registrar de novo com o PIN padrão.
 *   3. Se der "already registered", considera sucesso (idempotente).
 */
const ARKIEL_DEFAULT_PIN = process.env.WHATSAPP_2SV_PIN || '123456'

export async function registerPhoneNumber(phoneId, token) {
  try {
    return await axios.post(`${BASE}/${phoneId}/register`, {
      messaging_product: 'whatsapp',
      pin: ARKIEL_DEFAULT_PIN
    }, { headers: headers(token) })
  } catch (err) {
    const code = err?.response?.data?.error?.code
    const msg = err?.response?.data?.error?.message || ''

    // 133005 = PIN Mismatch — número já tinha outro PIN.
    // Tentamos desregistrar e registrar de novo com o PIN da Arkiel.
    if (code === 133005) {
      try {
        await axios.post(`${BASE}/${phoneId}/deregister`, {}, { headers: headers(token) })
      } catch (_) { /* pode falhar se já estava desregistrado — tudo bem */ }

      return axios.post(`${BASE}/${phoneId}/register`, {
        messaging_product: 'whatsapp',
        pin: ARKIEL_DEFAULT_PIN
      }, { headers: headers(token) })
    }

    // 133010 = "not registered" — pode acontecer se o número acabou de ser
    // desregistrado e ainda não foi re-registrado. Tenta registrar direto.
    if (code === 133010) {
      return axios.post(`${BASE}/${phoneId}/register`, {
        messaging_product: 'whatsapp',
        pin: ARKIEL_DEFAULT_PIN
      }, { headers: headers(token) })
    }

    // "already registered" — idempotente, não é erro.
    if (/already|registered/i.test(msg)) return { data: { success: true } }

    throw err
  }
}

/**
 * Assina o nosso app pros webhooks da WABA do cliente — sem isso, mensagens
 * recebidas nesse número não chegam no nosso /api/webhook.
 */
export async function subscribeAppToWaba(wabaId, token) {
  return axios.post(`${BASE}/${wabaId}/subscribed_apps`, {}, { headers: headers(token) })
}

/**
 * ===== Adicionar número sem Facebook (self-service via SMS) =====
 * Alternativa ao Embedded Signup: em vez do cliente logar com o Facebook
 * dele, a própria Arkiel (via token de Usuário do Sistema, permanente,
 * nunca enviado ao navegador do cliente) adiciona o número do cliente
 * dentro da WABA compartilhada da Arkiel, pede um código de verificação
 * por SMS/voz, e registra o número assim que o cliente informar o código.
 */

/** Adiciona um novo número de telefone à WABA compartilhada da Arkiel. */
export async function addPhoneNumberToWaba(wabaId, systemToken, cc, phoneNumber, verifiedName) {
  return axios.post(`${GRAPH_APP_BASE}/${wabaId}/phone_numbers`, {
    cc, phone_number: phoneNumber, verified_name: verifiedName
  }, { headers: headers(systemToken) })
}

/** Pede o código de verificação (SMS ou voz) pro número recém-adicionado. */
export async function requestVerificationCode(phoneId, systemToken, method = 'SMS') {
  return axios.post(`${GRAPH_APP_BASE}/${phoneId}/request_code`, {
    code_method: method, language: 'pt_BR'
  }, { headers: headers(systemToken) })
}

/** Confirma o código de verificação recebido por SMS/voz. */
export async function verifyPhoneCode(phoneId, systemToken, code) {
  return axios.post(`${GRAPH_APP_BASE}/${phoneId}/verify_code`, {
    code
  }, { headers: headers(systemToken) })
}

/** Lista os números já cadastrados numa WABA (usado pra achar um número que já existe como recurso, mesmo desregistrado, e evitar erro de duplicidade ao tentar readicionar). */
export async function listWabaPhoneNumbers(wabaId, token) {
  return axios.get(`${GRAPH_APP_BASE}/${wabaId}/phone_numbers`, {
    params: { fields: 'id,display_phone_number,verified_name,code_verification_status' },
    headers: { Authorization: `Bearer ${token}` }
  })
}

/**
 * ===== Envio de mídia (imagens, vídeos, documentos, áudio) =====
 * Fluxo da Meta: 
 *   1) Upload do arquivo via POST /{phone_number_id}/media (multipart) → retorna media_id
 *   2) Envio da mensagem via POST /{phone_number_id}/messages com o media_id
 */

/**
 * Faz upload de um arquivo de mídia para a Meta.
 * @param {string} phoneId - phone_number_id do bot
 * @param {string} token - access token
 * @param {Buffer} fileBuffer - conteúdo do arquivo
 * @param {string} filename - nome do arquivo
 * @param {string} mimeType - tipo MIME do arquivo
 * @returns {Promise<string>} media_id retornado pela Meta
 */
export async function uploadMedia(phoneId, token, fileBuffer, filename, mimeType) {
  const FormData = (await import('form-data')).default
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('file', fileBuffer, { filename, contentType: mimeType })

  const resp = await axios.post(`${BASE}/${phoneId}/media`, form, {
    headers: {
      ...form.getHeaders(),
      Authorization: `Bearer ${token}`,
    },
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  })
  
  if (!resp.data?.id) throw new Error('Meta não retornou media_id')
  return resp.data.id
}

/**
 * Envia uma mensagem de mídia (imagem, vídeo, documento ou áudio) via WhatsApp.
 * @param {string} phoneId - phone_number_id do bot
 * @param {string} token - access token
 * @param {string} to - número do destinatário (E.164)
 * @param {string} type - tipo da mídia: 'image' | 'video' | 'document' | 'audio'
 * @param {string} mediaId - media_id retornado pelo uploadMedia
 * @param {string} caption - legenda opcional (não suportada para áudio)
 * @param {string} filename - nome do arquivo (apenas para document)
 */
export async function sendMedia(phoneId, token, to, type, mediaId, caption, filename) {
  const mediaObj = { id: mediaId }
  if (caption && type !== 'audio') mediaObj.caption = caption
  if (filename && type === 'document') mediaObj.filename = filename

  return axios.post(`${BASE}/${phoneId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type,
    [type]: mediaObj,
  }, { headers: headers(token) })
}

/**
 * Detecta o tipo de mídia do WhatsApp baseado no mimeType.
 */
export function getMediaType(mimeType) {
  if (mimeType?.startsWith('image/')) return 'image'
  if (mimeType?.startsWith('video/')) return 'video'
  if (mimeType?.startsWith('audio/')) return 'audio'
  return 'document' // PDF, DOCX, etc
}
