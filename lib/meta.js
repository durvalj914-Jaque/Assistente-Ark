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
 * Gera um PIN de verificação de 6 dígitos aleatório — só é usado internamente
 * pela Meta pra habilitar backup/restore de registro, o cliente nunca vê isso.
 */
export async function registerPhoneNumber(phoneId, token) {
  const pin = String(Math.floor(100000 + Math.random() * 900000))
  return axios.post(`${BASE}/${phoneId}/register`, {
    messaging_product: 'whatsapp',
    pin
  }, { headers: headers(token) })
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
