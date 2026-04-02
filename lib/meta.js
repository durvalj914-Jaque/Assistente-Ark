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
