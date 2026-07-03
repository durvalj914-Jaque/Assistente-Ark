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
