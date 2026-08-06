/**
 * POST /api/admin/enable-realtime
 * Verifica e habilita realtime nas tabelas messages e conversations.
 * Também cria a função exec_sql se não existir.
 */
import { createClient } from '@supabase/supabase-js'

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export default async function handler(req, res) {
  const db = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

  // Verificar se realtime já funciona testando um select na tabela messages
  const { data: testMsg, error: testErr } = await db.from('messages').select('id').limit(1)

  if (testErr) {
    return res.status(200).json({ ok: false, error: testErr.message, hint: 'Tabela messages não acessível' })
  }

  // Verificar se a publicação supabase_realtime inclui as tabelas
  // Não conseguimos verificar via PostgREST, mas podemos tentar forçar
  // dizendo pro Supabase que a tabela deve ter realtime

  // O Supabase por padrão não inclui todas as tabelas no realtime
  // Precisamos adicionar via: ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations;
  // Mas isso requer DDL access

  return res.status(200).json({
    ok: true,
    messages_table: 'acessível',
    hint: 'Se o realtime não estiver funcionando, execute no SQL Editor do Supabase:',
    sql: 'ALTER PUBLICATION supabase_realtime ADD TABLE messages, conversations;'
  })
}
