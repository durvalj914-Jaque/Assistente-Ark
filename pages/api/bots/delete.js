import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { botId } = req.body
    if (!botId) {
      return res.status(400).json({ error: 'botId é obrigatório' })
    }

    // Client com service role key (bypassa RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      console.error('[bots/delete] Missing env vars')
      return res.status(500).json({ error: 'Configuração do servidor incompleta' })
    }

    const admin = createClient(supabaseUrl, serviceKey)

    // 1) Deleta messages (FK sem ON DELETE CASCADE)
    const { error: msgErr } = await admin
      .from('messages')
      .delete()
      .eq('bot_id', botId)
    if (msgErr) console.warn('[bots/delete] messages:', msgErr.message)

    // 2) Deleta conversations (tem CASCADE mas garantimos)
    const { error: convErr } = await admin
      .from('conversations')
      .delete()
      .eq('bot_id', botId)
    if (convErr) console.warn('[bots/delete] conversations:', convErr.message)

    // 3) Deleta o bot
    const { error: botErr, count } = await admin
      .from('bots')
      .delete()
      .eq('id', botId)

    if (botErr) {
      console.error('[bots/delete] bot delete error:', botErr)
      return res.status(500).json({ error: botErr.message })
    }

    if (count === 0) {
      return res.status(404).json({ error: 'Bot não encontrado ou já excluído' })
    }

    return res.status(200).json({ success: true, message: 'Bot excluído com sucesso' })
  } catch (err) {
    console.error('[bots/delete] catch:', err)
    return res.status(500).json({ error: err.message || 'Erro interno' })
  }
}
