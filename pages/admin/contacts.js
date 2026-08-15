import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import AdminLayout from '../../components/Layout/AdminLayout'
import { useTenant } from '../../hooks/useTenant'
import { supabase } from '../../lib/supabase'
import HelpTip from '../../components/HelpTip'

export default function ContactsPage() {
  const router = useRouter()
  const { user, tenant, role, profile, loading } = useTenant()
  const [contacts, setContacts] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [loadingContacts, setLoadingContacts] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const PAGE_SIZE = 50

  // Sync states
  const [syncMsg, setSyncMsg] = useState('')
  const [syncing, setSyncing] = useState(null) // 'google' | 'device' | null
  const [googleConnected, setGoogleConnected] = useState(false)
  const [showSyncMenu, setShowSyncMenu] = useState(false)
  const fileInputRef = useRef(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [addingContact, setAddingContact] = useState(false)
  const [addMsg, setAddMsg] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deviceSupported, setDeviceSupported] = useState(false)

  useEffect(() => { if (!loading && !user) router.replace('/assistente-ark/entrar') }, [user, loading])

  const loadContacts = useCallback(async (reset = false) => {
    if (!tenant) return
    setLoadingContacts(true)
    const from = reset ? 0 : page * PAGE_SIZE
    const { data, count } = await supabase
      .from('contacts').select('*', { count: 'exact' })
      .eq('tenant_id', tenant.id)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)
    if (reset) setContacts(data || [])
    else setContacts(prev => [...prev, ...(data || [])])
    setHasMore((from + PAGE_SIZE) < (count || 0))
    setLoadingContacts(false)
  }, [tenant, page])

  useEffect(() => { loadContacts(true) }, [tenant])

  // Detectar suporte a Contact Picker API
  useEffect(() => {
    setDeviceSupported(typeof navigator !== 'undefined' && 'contacts' in navigator && 'ContactsManager' in window)
  }, [])

  // Verificar se Google está conectado + ler params de retorno
  useEffect(() => {
    if (!tenant) return
    async function checkGoogle() {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/contacts/check-google?tenant_id=' + tenant.id, {
        headers: { Authorization: `Bearer ${session?.access_token || ''}` },
      })
      const d = await res.json().catch(() => ({}))
      setGoogleConnected(d.connected || false)
    }
    checkGoogle()

    // Verificar params de retorno do OAuth
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('google_connected') === '1') {
        setSyncMsg('✅ Google conectado com sucesso! Clique em "Sincronizar agora" para importar seus contatos.')
        setGoogleConnected(true)
        window.history.replaceState({}, '', window.location.pathname)
      }
      if (params.get('google_error')) {
        setSyncMsg('❌ Erro Google: ' + params.get('google_error'))
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [tenant])

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  async function handleSyncGoogle() {
    if (!tenant || syncing) return
    setShowSyncMenu(false)
    setSyncing('google')
    setSyncMsg('')
    try {
      const token = await getToken()
      const res = await fetch('/api/contacts/sync-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenant.id }),
      })
      const data = await res.json()
      if (data.needsAuth) {
        // Iniciar fluxo OAuth
        window.location.href = `/api/contacts/google-auth?tenant_id=${tenant.id}`
        return
      }
      if (data.ok) {
        const parts = [`✅ ${data.synced} contatos do Google!`]
        if (data.total_from_google) parts.push(`${data.total_from_google} encontrados`)
        if (data.total_in_db) parts.push(`${data.total_in_db} no total`)
        if (data.errors > 0) parts.push(`${data.errors} erros`)
        setSyncMsg(parts.join(' • '))
        setGoogleConnected(true)
        loadContacts(true)
      } else {
        setSyncMsg('❌ ' + (data.error || 'Erro ao sincronizar'))
      }
    } catch (e) {
      setSyncMsg('❌ Erro: ' + e.message)
    } finally { setSyncing(null) }
  }

  async function handleConnectGoogle() {
    if (!tenant) return
    setShowSyncMenu(false)
    window.location.href = `/api/contacts/google-auth?tenant_id=${tenant.id}`
  }

  async function handleDevicePicker() {
    setShowSyncMenu(false)

    // Se Contact Picker API estiver disponivel (mobile), usar direto
    if (deviceSupported) {
      try {
        setSyncing('device')
        setSyncMsg('Abrindo contatos do dispositivo...')
        const props = await navigator.contacts.getProperties()
        const selectedProps = ['name']
        if (props.includes('tel')) selectedProps.push('tel')
        if (props.includes('email')) selectedProps.push('email')

        const deviceContacts = await navigator.contacts.select(selectedProps, { multiple: true })
        if (!deviceContacts || deviceContacts.length === 0) {
          setSyncMsg('Nenhum contato selecionado.')
          setSyncing(null)
          return
        }

        const contactsList = deviceContacts.map(c => ({
          name: (c.name || []).join(' '),
          phone: (c.tel || [])[0] || '',
          email: (c.email || [])[0] || '',
        }))

        await importDeviceContacts(contactsList)
      } catch (e) {
        setSyncing(null)
        if (e.name === 'SecurityError' || e.name === 'AbortError') {
          setSyncMsg('⚠️ Sincronização cancelada.')
        } else {
          setSyncMsg('❌ Não foi possível acessar contatos: ' + e.message)
        }
      }
    } else {
      // Desktop: abrir upload de arquivo direto
      setSyncMsg('📱 Para sincronizar do celular, abra esta página no telefone. No computador, suba um arquivo .vcf ou .csv.')
      fileInputRef.current?.click()
    }
  }

  async function handleVCardUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setSyncing('device')
    setSyncMsg('')
    try {
      const token = await getToken()
      const formData = new FormData()
      formData.append('tenant_id', tenant.id)
      formData.append('source', 'device')
      formData.append('file', file)
      const res = await fetch('/api/contacts/import-device', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (data.ok) {
        const parts = [`✅ ${data.imported} contatos importados!`]
        if (data.newContacts) parts.push(`${data.newContacts} novos`)
        if (data.updatedContacts) parts.push(`${data.updatedContacts} atualizados`)
        if (data.errors > 0) parts.push(`${data.errors} erros`)
        setSyncMsg(parts.join(' • '))
        loadContacts(true)
      } else {
        setSyncMsg('❌ ' + (data.error || 'Erro ao importar'))
      }
    } catch (e) {
      setSyncMsg('❌ Erro: ' + e.message)
    } finally {
      setSyncing(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function importDeviceContacts(contactsList) {
    setSyncing('device')
    setSyncMsg('')
    try {
      const token = await getToken()
      const res = await fetch('/api/contacts/import-device', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tenant_id: tenant.id, contacts: contactsList, source: 'device' }),
      })
      const data = await res.json()
      if (data.ok) {
        const parts2 = [`✅ ${data.imported} contatos do dispositivo!`]
        if (data.newContacts) parts2.push(`${data.newContacts} novos`)
        if (data.updatedContacts) parts2.push(`${data.updatedContacts} atualizados`)
        setSyncMsg(parts2.join(' • '))
        loadContacts(true)
      } else {
        setSyncMsg('❌ ' + (data.error || 'Erro ao importar'))
      }
    } catch (e) {
      setSyncMsg('❌ Erro: ' + e.message)
    } finally { setSyncing(null) }
  }

  async function saveName() {
    if (!selected || !nameDraft.trim()) return
    setSavingName(true)
    const newName = nameDraft.trim()
    
    try {
      const token = await getToken()
      const res = await fetch('/api/contacts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contact_id: selected.id, name: newName }),
      })
      const data = await res.json()
      
      if (!data.ok) {
        alert('Erro ao salvar: ' + (data.error || 'Falha desconhecida'))
        setSavingName(false)
        return
      }
      
      // Atualizar UI com o retorno real do banco
      const updated = data.contact || { name: newName }
      setContacts(prev => prev.map(c => c.id === selected.id ? { ...c, ...updated } : c))
      setSelected(c => ({ ...c, ...updated }))
      setEditingName(false)
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally {
      setSavingName(false)
    }
  }

  function startEditName() {
    setNameDraft(selected.name || selected.full_name || '')
    setEditingName(true)
  }

  async function toggleOptIn(contact) {
    const newVal = !contact.opt_in
    try {
      const token = await getToken()
      await fetch('/api/contacts/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contact_id: contact.id, opt_in: newVal }),
      })
    } catch (e) { /* ignore */ }
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, opt_in: newVal } : c))
    if (selected?.id === contact.id) setSelected(c => ({ ...c, opt_in: newVal }))
  }

  async function startConversation() {
    if (!selected || startingChat) return
    setStartingChat(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/conversations/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contact_id: selected.id }),
      })
      const data = await res.json()
      if (data.ok) {
        router.push(`/admin/conversations?conv=${data.conversation_id}`)
      } else {
        alert('Erro: ' + (data.error || 'Falha ao iniciar conversa'))
      }
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally { setStartingChat(false) }
  }

  async function addContact() {
    if (!tenant || addingContact) return
    if (!newPhone.trim() && !newEmail.trim()) {
      setAddMsg('Telefone ou e-mail e obrigatorio')
      return
    }
    setAddingContact(true)
    setAddMsg('')
    try {
      const token = await getToken()
      const res = await fetch('/api/contacts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          tenant_id: tenant.id,
          name: newName.trim() || null,
          phone: newPhone.trim() || null,
          email: newEmail.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        if (data.created) {
          setContacts(prev => [data.contact, ...prev])
          setAddMsg('+ Contato adicionado!')
        } else {
          setContacts(prev => prev.map(c => c.id === data.contact.id ? { ...c, ...data.contact } : c))
          setAddMsg(data.message || 'Contato ja existia')
        }
        setNewName('')
        setNewPhone('')
        setNewEmail('')
        setTimeout(() => { setShowAddModal(false); setAddMsg('') }, 1500)
        loadContacts(true)
      } else {
        setAddMsg('Erro: ' + (data.error || 'Falha ao adicionar'))
      }
    } catch (e) {
      setAddMsg('Erro: ' + e.message)
    } finally { setAddingContact(false) }
  }

  async function deleteContact() {
    if (!selected || deleting) return
    setDeleting(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/contacts/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contact_id: selected.id }),
      })
      const data = await res.json()
      if (data.ok) {
        setContacts(prev => prev.filter(c => c.id !== selected.id))
        setSelected(null)
        setConfirmDelete(false)
      } else {
        alert('Erro ao excluir: ' + (data.error || 'Falha'))
      }
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally { setDeleting(false) }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)))
    }
  }

  function clearBulkSelection() {
    setSelectedIds(new Set())
    setConfirmBulk(false)
  }

  async function bulkDeleteContacts() {
    if (selectedIds.size === 0 || bulkDeleting) return
    setBulkDeleting(true)
    try {
      const token = await getToken()
      const ids = Array.from(selectedIds)
      const res = await fetch('/api/contacts/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contact_ids: ids }),
      })
      const data = await res.json()
      if (data.ok) {
        setContacts(prev => prev.filter(c => !selectedIds.has(c.id)))
        clearBulkSelection()
        setBulkMode(false)
      } else {
        alert('Erro: ' + (data.error || 'Falha ao excluir'))
      }
    } catch (e) {
      alert('Erro: ' + e.message)
    } finally { setBulkDeleting(false) }
  }

  const filtered = search
    ? contacts.filter(c =>
        (c.name || c.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.phone || '').includes(search) ||
        (c.email || '').toLowerCase().includes(search.toLowerCase())
      )
    : contacts

  if (loading) return <div className="ark-page-loading"><div className="ark-spinner" /> Carregando…</div>
  if (!user || !tenant) return null

  return (
    <AdminLayout tenant={tenant} user={user} role={role} profile={profile}>
      <input ref={fileInputRef} type="file" accept=".vcf,.vcard,.csv" onChange={handleVCardUpload} style={{ display: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center' }}>
            👥 Contatos
            <HelpTip text="Toda pessoa que escreveu pro seu WhatsApp vira contato aqui. Sincronize com o Google ou importe do dispositivo pra ter todos em um só lugar." />
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{contacts.length} contatos</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Buscar…" className="ark-input" style={{ width: 200 }} />
          <button
            onClick={() => { setBulkMode(b => !b); setSelectedIds(new Set()); setConfirmBulk(false) }}
            className={bulkMode ? "ark-btn" : "ark-btn-ghost"}
            style={{ fontSize: 13, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            ☐ Selecionar
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="ark-btn"
            style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            ＋ Novo contato
          </button>
          {/* Botão Sincronizar — dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSyncMenu(o => !o)}
              disabled={!!syncing}
              className="ark-btn"
              style={{ fontSize: 13, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {syncing ? (
                <><div className="ark-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> Sincronizando…</>
              ) : (
                <>🔄 Sincronizar</>
              )}
            </button>

            {showSyncMenu && !syncing && (
              <>
                <div onClick={() => setShowSyncMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
                <div style={{
                  position: 'absolute', top: 42, right: 0, zIndex: 200,
                  background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
                  borderRadius: 12, padding: 6, minWidth: 260,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                }}>
                  {/* Google */}
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-soft)', marginBottom: 4 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>GOOGLE</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: googleConnected ? '#10b981' : '#64748b',
                      }} />
                      <span style={{ fontSize: 12, color: googleConnected ? '#10b981' : 'var(--text-muted)' }}>
                        {googleConnected ? 'Conectado' : 'Não conectado'}
                      </span>
                    </div>
                    {!googleConnected ? (
                      <button onClick={handleConnectGoogle}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        🔵 Conectar Google
                      </button>
                    ) : (
                      <button onClick={handleSyncGoogle}
                        style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        🔄 Sincronizar contatos do Google
                      </button>
                    )}
                  </div>

                  {/* Dispositivo */}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>DISPOSITIVO</div>
                    <button onClick={handleDevicePicker}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                      📱 Sincronizar do dispositivo
                    </button>
                    <button onClick={() => { setShowSyncMenu(false); fileInputRef.current?.click() }}
                      style={{ width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', marginTop: 4 }}>
                        📁 Upload de arquivo .vcf
                      </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mensagem de status */}
      {syncMsg && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 10, fontSize: 13,
          background: syncMsg.startsWith('✅') ? 'rgba(16,185,129,0.1)' : syncMsg.startsWith('❌') ? 'rgba(239,68,68,0.1)' : 'rgba(79,142,247,0.1)',
          color: syncMsg.startsWith('✅') ? '#10b981' : syncMsg.startsWith('❌') ? '#ef4444' : '#4f8ef7',
          border: `1px solid ${syncMsg.startsWith('✅') ? 'rgba(16,185,129,0.2)' : syncMsg.startsWith('❌') ? 'rgba(239,68,68,0.2)' : 'rgba(79,142,247,0.2)'}`,
        }}>
          {syncMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 320px' : '1fr', gap: 16 }}>
        {/* Tabela */}
        <div className="ark-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="ark-table">
            <thead>
              <tr>
                {bulkMode && (
                  <th style={{ width: 36, textAlign: 'center' }}>
                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onChange={toggleSelectAll}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f8ef7' }} />
                  </th>
                )}
                <th>Contato</th>
                <th>Telefone</th>
                <th>E-mail</th>
                <th>Origem</th>
                <th>Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
                  {search ? 'Nenhum resultado' : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 12 }}>📇</div>
                      Nenhum contato ainda.<br />
                      <span style={{ fontSize: 12 }}>Clique em <b style={{ color: 'var(--text-primary)' }}>🔄 Sincronizar</b> pra importar do Google ou dispositivo.</span>
                    </div>
                  )}
                </td></tr>
              )}
              {filtered.map(c => {
                const name = c.name || c.full_name || ''
                const isBulkSelected = selectedIds.has(c.id)
                return (
                  <tr key={c.id}
                    onClick={() => bulkMode ? toggleSelect(c.id) : setSelected(s => s?.id === c.id ? null : c)}
                    style={{
                      cursor: 'pointer',
                      background: bulkMode
                        ? (isBulkSelected ? 'rgba(239,68,68,0.08)' : undefined)
                        : (selected?.id === c.id ? 'rgba(79,142,247,0.07)' : undefined),
                    }}>
                    {bulkMode && (
                      <td style={{ textAlign: 'center', width: 36 }} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isBulkSelected}
                          onChange={() => toggleSelect(c.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#ef4444' }} />
                      </td>
                    )}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {c.photo_url ? (
                          <img src={c.photo_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0, color: '#fff' }}>
                            {(name || c.phone || '?')[0].toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{name || <span style={{ color: 'var(--text-muted)' }}>Sem nome</span>}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)' }}>{c.phone || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{c.email || '—'}</td>
                    <td>
                      {c.source === 'device' ? '📱 Dispositivo' :
                       c.google_resource_name ? '🔵 Google' :
                       '💬 WhatsApp'}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {hasMore && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <button onClick={() => { setPage(p => p + 1); loadContacts() }} className="ark-btn-ghost" disabled={loadingContacts}>
                {loadingContacts ? 'Carregando…' : 'Carregar mais'}
              </button>
            </div>
          )}
        </div>

        {/* Detalhe do contato */}
        {selected && (
          <div className="ark-card" style={{ position: 'sticky', top: 80, alignSelf: 'start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 14 }}>Detalhes</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', margin: '0 auto 8px', display: 'block' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,#4f8ef7,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, margin: '0 auto 8px', color: '#fff' }}>
                    {(selected.name || selected.full_name || selected.phone || '?')[0].toUpperCase()}
                  </div>
                )}
                {editingName ? (
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 4 }}>
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={e => setNameDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
                      placeholder="Nome do contato"
                      className="ark-input"
                      style={{ fontSize: 14, padding: '6px 10px', width: 180, textAlign: 'center' }}
                    />
                    <button onClick={saveName} disabled={savingName || !nameDraft.trim()}
                      style={{ background: '#4f8ef7', border: 'none', borderRadius: 8, color: '#fff', padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {savingName ? '…' : '✓ Salvar'}
                    </button>
                    <button onClick={() => setEditingName(false)}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-soft)', borderRadius: 8, color: 'var(--text-muted)', padding: '6px 10px', cursor: 'pointer', fontSize: 12 }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                      {selected.name || selected.full_name || 'Sem nome'}
                    </span>
                    <button onClick={startEditName}
                      title="Editar nome"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', fontSize: 14, color: 'var(--text-muted)', opacity: 0.6, display: 'flex', alignItems: 'center' }}>
                      ✏️
                    </button>
                  </div>
                )}
                {selected.organization && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{selected.organization}{selected.job_title ? ' · ' + selected.job_title : ''}</div>}
              </div>
              {[
                ['📱 Telefone', selected.phone || '—'],
                ['📧 E-mail', selected.email || '—'],
                ['📌 Origem', selected.source === 'device' ? '📱 Dispositivo' : selected.google_resource_name ? '🔵 Google' : '💬 WhatsApp'],
                ['📅 Cadastro', new Date(selected.created_at).toLocaleDateString('pt-BR')],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              <button onClick={startConversation} disabled={startingChat || !selected.phone}
                className="ark-btn" style={{ width: '100%', justifyContent: 'center', marginTop: 4, fontSize: 13, padding: '10px', opacity: (startingChat || !selected.phone) ? 0.5 : 1 }}
                title={selected.phone ? 'Iniciar nova conversa no WhatsApp' : 'Contato sem telefone'}>
                {startingChat ? '⏳ Iniciando...' : '💬 Iniciar conversa'}
              </button>
              <button onClick={() => router.push(`/admin/conversations?contact=${selected.id}`)}
                className="ark-btn-ghost" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }}>
                Ver conversas →
              </button>
              {confirmDelete ? (
                <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', marginBottom: 10 }}>
                    Excluir {(selected.name || selected.phone || 'este contato')}? Esta acao nao pode ser desfeita.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={deleteContact} disabled={deleting}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: '#ef4444', color: '#fff', opacity: deleting ? 0.5 : 1 }}>
                      {deleting ? 'Excluindo...' : 'Sim, excluir'}
                    </button>
                    <button onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1px solid var(--border-soft)', cursor: 'pointer', fontSize: 12, background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '10px', fontSize: 13, fontWeight: 500, background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, cursor: 'pointer' }}>
                  🗑 Excluir contato
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {/* Barra de acoes em massa */}
      {bulkMode && selectedIds.size > 0 && (
        <div style={{
          position: 'sticky', bottom: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 12, padding: '12px 20px', marginTop: 16,
          background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 12, boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>{selectedIds.size}</b> contato(s) selecionado(s)
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            {confirmBulk ? (
              <>
                <span style={{ fontSize: 12, color: '#ef4444', alignSelf: 'center', marginRight: 4 }}>
                  Confirmar exclusao? Nao pode ser desfeita.
                </span>
                <button onClick={bulkDeleteContacts} disabled={bulkDeleting}
                  style={{ padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: '#ef4444', color: '#fff', opacity: bulkDeleting ? 0.5 : 1 }}>
                  {bulkDeleting ? 'Excluindo...' : 'Sim, excluir tudo'}
                </button>
                <button onClick={() => setConfirmBulk(false)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-soft)', cursor: 'pointer', fontSize: 13, background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setConfirmBulk(true)}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}>
                  🗑 Excluir ({selectedIds.size})
                </button>
                <button onClick={clearBulkSelection}
                  className="ark-btn-ghost" style={{ fontSize: 13, padding: '8px 16px' }}>
                  Limpar
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Modal Novo Contato */}
      {showAddModal && (
        <>
          <div onClick={() => { setShowAddModal(false); setAddMsg('') }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 300, backdropFilter: 'blur(2px)' }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 400, width: '90%', maxWidth: 420,
            background: 'var(--bg-card)', border: '1px solid var(--border-medium)',
            borderRadius: 16, padding: 24, boxShadow: '0 16px 64px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 16, margin: 0 }}>＋ Novo contato</h3>
              <button onClick={() => { setShowAddModal(false); setAddMsg('') }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>NOME</label>
                <input value={newName} onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && newPhone.trim()) addContact() }}
                  placeholder="Nome do contato"
                  className="ark-input" style={{ width: '100%' }} autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>TELEFONE *</label>
                <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (newPhone.trim() || newEmail.trim())) addContact() }}
                  placeholder="5511999999999"
                  className="ark-input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4, display: 'block' }}>E-MAIL</label>
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (newPhone.trim() || newEmail.trim())) addContact() }}
                  placeholder="email@exemplo.com"
                  className="ark-input" style={{ width: '100%' }} />
              </div>
              {addMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 8, fontSize: 13,
                  background: addMsg.startsWith('+') ? 'rgba(16,185,129,0.1)' : addMsg.startsWith('Erro') ? 'rgba(239,68,68,0.1)' : 'rgba(79,142,247,0.1)',
                  color: addMsg.startsWith('+') ? '#10b981' : addMsg.startsWith('Erro') ? '#ef4444' : '#4f8ef7',
                }}>{addMsg}</div>
              )}
              <button onClick={addContact} disabled={addingContact || (!newPhone.trim() && !newEmail.trim())}
                className="ark-btn"
                style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 14, opacity: (addingContact || (!newPhone.trim() && !newEmail.trim())) ? 0.5 : 1 }}>
                {addingContact ? 'Adicionando...' : 'Adicionar contato'}
              </button>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  )
}
