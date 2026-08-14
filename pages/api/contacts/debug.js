/**
 * GET /api/contacts/debug
 * Diagnóstico completo: colunas, RLS, contatos, e teste de update
 */
import { supabase, supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const results = {}
  
  try {
    const db = supabaseAdmin()
    
    // 1. Listar contatos
    const { data: contacts, error: contactsErr } = await db.from('contacts').select('*').limit(5)
    results.contacts = contacts || []
    results.contactsError = contactsErr?.message || null
    results.contactsCount = contacts?.length || 0
    
    // 2. Se há contatos, tentar UPDATE
    if (contacts && contacts.length > 0) {
      const testId = contacts[0].id
      const testName = 'TESTE_' + Date.now()
      
      // Tentar update com name
      const { data: updated, error: updateErr } = await db.from('contacts')
        .update({ name: testName })
        .eq('id', testId)
        .select()
      
      results.updateTest = {
        id: testId,
        oldName: contacts[0].name,
        newName: testName,
        updatedData: updated,
        error: updateErr?.message || null,
        errorCode: updateErr?.code || null
      }
      
      // Reverter
      if (contacts[0].name) {
        await db.from('contacts').update({ name: contacts[0].name }).eq('id', testId)
      }
    }
    
    // 3. Tentar INSERT + UPDATE + DELETE de teste
    const { data: inserted, error: insertErr } = await db.from('contacts')
      .insert({ phone: '+5511999999999', name: 'TESTE_INSERT' })
      .select()
    
    results.insertTest = {
      data: inserted,
      error: insertErr?.message || null
    }
    
    if (inserted && inserted.length > 0) {
      // Update no inserido
      const { data: upd2, error: upd2Err } = await db.from('contacts')
        .update({ name: 'TESTE_UPDATE' })
        .eq('id', inserted[0].id)
        .select()
      
      results.updateInsertedTest = {
        data: upd2,
        error: upd2Err?.message || null
      }
      
      // Delete
      await db.from('contacts').delete().eq('id', inserted[0].id)
      results.deleteTest = { ok: true }
    }
    
    // 4. Verificar colunas da tabela
    const { data: columns, error: colErr } = await db.rpc('pg_table_columns', { table_name: 'contacts' }).catch(() => ({ data: null, error: { message: 'RPC not available' } }))
    results.columns = columns || 'RPC not available'
    results.columnsError = colErr?.message || null
    
  } catch (e) {
    results.fatalError = e.message
  }
  
  return res.status(200).json(results)
}
