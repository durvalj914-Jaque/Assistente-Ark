export default async function handler(req, res) {
  if (req.method === 'GET') {
    // Simular exatamente o fluxo do webhook
    const results = {}

    try {
      const { createClient } = await import('@supabase/supabase-js')
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { persistSession: false } }
      )

      // Step 1: buscar bot com JOIN
      const { data: botArr, error: botErr } = await db
        .from('bots')
        .select('id, name, status, phone_number_id, tenant_id, access_token, greeting, fallback_message, human_takeover_keyword, flow, tenants(id, plan, status, max_messages_month)')
        .eq('phone_number_id', '1055720357624339')
        .eq('status', 'active')
        .limit(1)

      results.step1_bot = botErr ? `ERROR: ${botErr.message}` : `OK: ${botArr?.length} bots, name=${botArr?.[0]?.name}, tenant_status=${botArr?.[0]?.tenants?.status}`

      const bot = botArr?.[0]
      if (!bot) return res.json({ results, error: 'bot not found' })

      const tenantId = bot.tenant_id
      const from = '55911913751590'

      // Step 2: upsert contato
      const { data: contact, error: contactErr } = await db
        .from('contacts')
        .upsert(
          { tenant_id: tenantId, phone: from, name: 'TestDiag', updated_at: new Date().toISOString() },
          { onConflict: 'tenant_id,phone' }
        )
        .select().single()

      results.step2_contact = contactErr ? `ERROR: ${contactErr.message}` : `OK: contact id=${contact?.id}`

      if (!contact) return res.json({ results, error: 'contact failed' })

      // Step 3: criar conversa
      const { data: conv, error: convErr } = await db
        .from('conversations')
        .insert({ tenant_id: tenantId, bot_id: bot.id, contact_id: contact.id, status: 'bot' })
        .select().single()

      results.step3_conv = convErr ? `ERROR: ${convErr.message}` : `OK: conv id=${conv?.id}`

      // Step 4: enviar mensagem via Meta
      const { default: axios } = await import('axios')
      const metaRes = await axios.post(
        `https://graph.facebook.com/v19.0/${bot.phone_number_id}/messages`,
        {
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: bot.greeting || 'Olá! Sou o assistente da Arkiel. 🤖' }
        },
        { headers: { Authorization: `Bearer ${bot.access_token}`, 'Content-Type': 'application/json' } }
      ).catch(e => ({ data: { error: e.response?.data || e.message } }))

      results.step4_send = `OK: ${JSON.stringify(metaRes.data)}`

    } catch(e) {
      results.exception = e.message + ' | ' + e.stack?.substring(0,200)
    }

    return res.json({ results })
  }

  res.status(405).end()
}
