// Documentação de endpoints da plataforma Assistente Ark
// a: 'api-key' (Bearer ark_live_...) | 'session' (login Google) | 'meta' (webhook assinado Meta)
//    'mp' (webhook assinado Mercado Pago) | 'public' (sem autenticação)

export const API_DOC_CATEGORIES = [
  {
    id: 'public', icon: '🌐', title: 'API Pública',
    desc: 'Integração externa — use sua chave de API no header Authorization.',
    endpoints: [
      { m: 'POST', p: '/api/v1/send', d: 'Envia mensagem de WhatsApp pelo bot ativo da empresa (to, message).', a: 'api-key' },
    ],
  },
  {
    id: 'conversations', icon: '💬', title: 'Mensagens & Conversas',
    desc: 'Envio de mensagens, mídias e controle de conversas pelo painel.',
    endpoints: [
      { m: 'POST', p: '/api/send-message', d: 'Envia mensagem de texto numa conversa do painel.', a: 'session' },
      { m: 'POST', p: '/api/send-media', d: 'Envia imagem/áudio/documento numa conversa (multipart).', a: 'session' },
      { m: 'POST', p: '/api/toggle-mode', d: 'Alterna a conversa entre modo bot e modo humano.', a: 'session' },
      { m: 'POST', p: '/api/conversations/start', d: 'Inicia (ou retoma) uma conversa com um contato.', a: 'session' },
      { m: 'POST', p: '/api/conversations/toggle-bot', d: 'Liga/desliga o bot para uma conversa específica.', a: 'session' },
      { m: 'POST', p: '/api/conversations/delete', d: 'Exclui uma conversa e suas mensagens.', a: 'session' },
      { m: 'GET', p: '/api/conversations/media', d: 'Lista mídias de uma conversa.', a: 'session' },
      { m: 'GET', p: '/api/media/[mediaId]', d: 'Baixa uma mídia por ID (com bot_id para validação).', a: 'session' },
    ],
  },
  {
    id: 'whatsapp', icon: '📲', title: 'WhatsApp & Números',
    desc: 'Conexão e ciclo de vida do número na WABA compartilhada (token de sistema).',
    endpoints: [
      { m: 'POST', p: '/api/whatsapp/add-number', d: 'Adiciona o número à WABA e dispara o código de verificação por SMS.', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/confirm-number', d: 'Confirma o código SMS e ativa o bot no número.', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/activate-number', d: 'Ativa número já existente na WABA (reconexão).', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/migrate-number', d: 'Migra número de app oficial para o Cloud API.', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/list-numbers', d: 'Lista números da WABA e status de cada um.', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/disconnect', d: 'Desconecta o número (deregister na Meta + limpeza).', a: 'session' },
      { m: 'POST', p: '/api/whatsapp/embedded-signup', d: 'Embedded Signup via Facebook (fluxo alternativo).', a: 'session' },
      { m: 'GET+POST', p: '/api/whatsapp/profile-photo', d: 'Consulta ou troca a foto de perfil do número (Resumable Upload).', a: 'session' },
    ],
  },
  {
    id: 'catalog', icon: '🛍️', title: 'Catálogo & Produtos',
    desc: 'Vitrine do WhatsApp Commerce e sincronização com o catálogo da Meta.',
    endpoints: [
      { m: 'GET', p: '/api/catalog/products', d: 'Lista produtos da vitrine (público para o bot/painel).', a: 'session' },
      { m: 'POST', p: '/api/catalog/buy', d: 'Processa pedido vindo do carrinho do WhatsApp.', a: 'public' },
      { m: 'POST', p: '/api/products/sync-catalog', d: 'Upsert/remove produto no catálogo oficial da Meta.', a: 'session' },
      { m: 'POST', p: '/api/products/upload-image', d: 'Upload de imagem de produto (multipart).', a: 'session' },
    ],
  },
  {
    id: 'contacts', icon: '👥', title: 'Contatos',
    desc: 'CRUD, importação (Google/Dispositivo) e sincronização de contatos.',
    endpoints: [
      { m: 'GET', p: '/api/contacts/list', d: 'Lista contatos com paginação e busca.', a: 'session' },
      { m: 'POST', p: '/api/contacts/create', d: 'Cria um contato.', a: 'session' },
      { m: 'POST', p: '/api/contacts/update', d: 'Atualiza dados de um contato.', a: 'session' },
      { m: 'POST', p: '/api/contacts/delete', d: 'Exclui um contato.', a: 'session' },
      { m: 'POST', p: '/api/contacts/bulk-delete', d: 'Exclusão em massa (IDs).', a: 'session' },
      { m: 'POST', p: '/api/contacts/import-device', d: 'Importa contatos de .vcf/.csv do dispositivo.', a: 'session' },
      { m: 'GET', p: '/api/contacts/google-auth', d: 'Inicia OAuth do Google para importar contatos.', a: 'session' },
      { m: 'GET', p: '/api/contacts/google-callback', d: 'Callback OAuth do Google (redireciona).', a: 'public' },
      { m: 'POST', p: '/api/contacts/store-google-token', d: 'Armazena o token Google para sincronização.', a: 'session' },
      { m: 'POST', p: '/api/contacts/sync-google', d: 'Sincroniza contatos da conta Google.', a: 'session' },
      { m: 'GET', p: '/api/contacts/check-google', d: 'Verifica se a conta Google está conectada.', a: 'session' },
    ],
  },
  {
    id: 'calendar', icon: '📅', title: 'Agendamento (Google Agenda)',
    desc: 'Autorização da agenda, eventos e feed de compromissos.',
    endpoints: [
      { m: 'GET', p: '/api/calendar/auth-url', d: 'Gera a URL de autorização do Google Agenda.', a: 'session' },
      { m: 'GET', p: '/api/calendar/callback', d: 'Callback OAuth da agenda (salva conexão).', a: 'public' },
      { m: 'GET', p: '/api/calendar/ics', d: 'Feed .ics dos agendamentos confirmados.', a: 'session' },
      { m: 'GET+DELETE', p: '/api/calendar/status', d: 'Consulta status da agenda conectada / desconecta.', a: 'session' },
    ],
  },
  {
    id: 'marketing', icon: '📣', title: 'Marketing & Créditos',
    desc: 'Broadcasts, templates e sistema pré-pago de conversas.',
    endpoints: [
      { m: 'POST', p: '/api/marketing/send', d: 'Dispara broadcast/template para uma lista de contatos.', a: 'session' },
      { m: 'POST', p: '/api/marketing/upload-image', d: 'Upload de imagem do template (multipart).', a: 'session' },
      { m: 'GET', p: '/api/credits/balance', d: 'Saldo de créditos (Utility e Marketing).', a: 'session' },
      { m: 'GET', p: '/api/credits/history', d: 'Histórico de consumo de créditos.', a: 'session' },
      { m: 'GET+POST', p: '/api/credits/purchase', d: 'Compra pacote de créditos (gera PIX do Mercado Pago).', a: 'session' },
    ],
  },
  {
    id: 'payments', icon: '💸', title: 'Pagamentos (Mercado Pago)',
    desc: 'Cobranças, comprovantes, split de taxas e conexão OAuth do MP.',
    endpoints: [
      { m: 'GET+POST', p: '/api/payments/config', d: 'Configuração de cobrança do tenant (chave PIX etc.).', a: 'session' },
      { m: 'POST', p: '/api/payments/create', d: 'Cria uma cobrança (PIX dinâmico) para um cliente.', a: 'session' },
      { m: 'POST', p: '/api/payments/cancel', d: 'Cancela uma cobrança pendente.', a: 'session' },
      { m: 'GET', p: '/api/payments/list', d: 'Lista cobranças do tenant.', a: 'session' },
      { m: 'GET', p: '/api/payments/history', d: 'Histórico de pagamentos recebidos.', a: 'session' },
      { m: 'GET', p: '/api/payments/conv-charges', d: 'Cobranças vinculadas a uma conversa.', a: 'session' },
      { m: 'GET+POST+DELETE', p: '/api/payments/receipts', d: 'Comprovantes enviados por clientes (aprovar/rejeitar).', a: 'session' },
      { m: 'GET+POST+PATCH+DELETE', p: '/api/payment-methods', d: 'CRUD de métodos de pagamento aceitos.', a: 'session' },
      { m: 'GET', p: '/api/mercadopago/methods', d: 'Métodos disponíveis na conta MP conectada.', a: 'session' },
      { m: 'GET', p: '/api/mercadopago/status', d: 'Status da conexão OAuth com o Mercado Pago.', a: 'session' },
      { m: 'GET', p: '/api/mercadopago/oauth/init', d: 'Inicia OAuth do Mercado Pago (split de taxas).', a: 'session' },
      { m: 'GET', p: '/api/mercadopago/oauth/callback', d: 'Callback OAuth do Mercado Pago.', a: 'public' },
      { m: 'POST', p: '/api/mercadopago/force-disconnect', d: 'Desconecta a conta MP do tenant.', a: 'session' },
    ],
  },
  {
    id: 'plans', icon: '⭐', title: 'Planos & Assinatura',
    desc: 'Assinatura do SaaS, verificação de status e webhooks de billing.',
    endpoints: [
      { m: 'POST', p: '/api/plans/list', d: 'Planos disponíveis para upgrade.', a: 'session' },
      { m: 'POST', p: '/api/plans/subscribe', d: 'Inicia assinatura de um plano.', a: 'session' },
      { m: 'POST', p: '/api/billing/plans', d: 'Consulta planos com preços de billing.', a: 'session' },
      { m: 'GET', p: '/api/billing/status', d: 'Status atual da assinatura do tenant.', a: 'session' },
      { m: 'POST', p: '/api/billing/verify-google', d: 'Verifica compra processada pelo Google.', a: 'session' },
    ],
  },
  {
    id: 'bots', icon: '🤖', title: 'Bots & Fluxo',
    desc: 'Geração de fluxo com IA e gestão de bots.',
    endpoints: [
      { m: 'POST', p: '/api/generate-flow', d: 'Gera fluxo do bot com IA a partir de descrição em texto.', a: 'session' },
      { m: 'POST', p: '/api/bots/delete', d: 'Exclui um bot (e limpa recursos).', a: 'session' },
    ],
  },
  {
    id: 'push', icon: '🔔', title: 'Notificações Push',
    desc: 'Web Push (VAPID) e FCM (app Android).',
    endpoints: [
      { m: 'POST', p: '/api/push/subscribe', d: 'Registra inscrição Web Push do navegador.', a: 'session' },
      { m: 'POST', p: '/api/push/unsubscribe', d: 'Remove inscrição Web Push.', a: 'session' },
      { m: 'POST', p: '/api/push/register-fcm', d: 'Registra token FCM (app Android).', a: 'session' },
      { m: 'POST', p: '/api/push/unregister-fcm', d: 'Remove token FCM.', a: 'session' },
      { m: 'POST', p: '/api/push/settings', d: 'Preferências de notificação (handoff humano etc.).', a: 'session' },
      { m: 'POST', p: '/api/push/test', d: 'Dispara notificação de teste.', a: 'session' },
    ],
  },
  {
    id: 'webhooks', icon: '🪝', title: 'Webhooks de Entrada',
    desc: 'Recebem eventos externos — validação própria por assinatura/verificação.',
    endpoints: [
      { m: 'GET+POST', p: '/api/webhook/[botId]', d: 'Webhook da Meta Cloud API: mensagens, status e conversas.', a: 'meta' },
      { m: 'GET+POST', p: '/api/webhook', d: 'Webhook raiz da Meta (verificação de handshake).', a: 'meta' },
      { m: 'POST', p: '/api/payments/webhook/mercadopago', d: 'Confirmações de pagamento do Mercado Pago (PIX, split).', a: 'mp' },
      { m: 'POST', p: '/api/mercadopago/webhook', d: 'Webhook antigo do Mercado Pago (legado).', a: 'mp' },
      { m: 'POST', p: '/api/billing/webhook-google', d: 'Eventos de assinatura processados pelo Google.', a: 'public' },
    ],
  },
  {
    id: 'internal', icon: '🔒', title: 'Interno (equipe Arkiel)',
    desc: 'Endpoints administrativos e de manutenção — exigem sessão de platform admin.',
    endpoints: [
      { m: 'POST', p: '/api/admin/create-client', d: 'Wizard de novo cliente (pré-provisiona tenant).', a: 'session' },
      { m: 'POST', p: '/api/admin/update-client', d: 'Atualiza dados de um tenant.', a: 'session' },
      { m: 'POST', p: '/api/admin/clients', d: 'Painel: lista/gerencia clientes B2B.', a: 'session' },
      { m: 'GET', p: '/api/admin/conversations', d: 'Painel: todas as conversas da plataforma.', a: 'session' },
      { m: 'GET', p: '/api/admin/logs', d: 'Painel: logs de atividade da plataforma.', a: 'session' },
      { m: 'POST', p: '/api/admin/usage', d: 'Painel: uso de conversas por tenant.', a: 'session' },
      { m: 'GET', p: '/api/admin/usage-costs', d: 'Painel: custos Meta por tenant (Conversas Iniciadas).', a: 'session' },
      { m: 'GET', p: '/api/admin/template-analytics', d: 'Painel: conferência Meta Analytics x tracking interno.', a: 'session' },
      { m: 'POST', p: '/api/admin/confirm-whatsapp', d: 'Confirma conexão de número manualmente.', a: 'session' },
      { m: 'POST', p: '/api/admin/deregister-bot', d: 'Desregistra bot na Meta (desconexão admin).', a: 'session' },
      { m: 'POST', p: '/api/admin/setup-catalog', d: 'Cria/conecta catálogo Meta à WABA.', a: 'session' },
      { m: 'GET', p: '/api/admin/resync-catalog', d: 'Resincroniza catálogo Meta completo.', a: 'session' },
      { m: 'POST', p: '/api/admin/sync-product', d: 'Sincroniza produto individual no catálogo Meta.', a: 'session' },
      { m: 'GET+POST', p: '/api/admin/commerce-settings', d: 'Settings do WhatsApp Commerce.', a: 'session' },
      { m: 'GET+POST', p: '/api/admin/fee-config', d: 'Configuração das taxas da plataforma.', a: 'session' },
      { m: 'GET+POST', p: '/api/admin/fees', d: 'Taxas pendentes/cobrança mensal das taxas.', a: 'session' },
      { m: 'GET+PATCH', p: '/api/admin/commissions', d: 'Ciclos e eventos de comissão.', a: 'session' },
      { m: 'GET+POST', p: '/api/admin/marketplace-config', d: 'Split Mercado Pago (marketplace oficial).', a: 'session' },
      { m: 'GET+POST+PATCH+DELETE', p: '/api/admin/plans', d: 'CRUD dos planos do SaaS.', a: 'session' },
      { m: 'GET+POST+PATCH+DELETE', p: '/api/admin/plan-resources', d: 'Recursos incluídos em cada plano.', a: 'session' },
      { m: 'GET+POST+PATCH+DELETE', p: '/api/admin/addons', d: 'Add-ons opcionais por plano.', a: 'session' },
      { m: 'GET+POST', p: '/api/admin/bank-account', d: 'Conta bancária de recebimento.', a: 'session' },
      { m: 'POST', p: '/api/admin/enable-realtime', d: 'Habilita realtime do Supabase p/ tenant.', a: 'session' },
      { m: 'POST', p: '/api/admin/ensure-media-columns', d: 'Garante colunas de mídia no banco.', a: 'session' },
      { m: 'POST', p: '/api/admin/migrate-media-columns', d: 'Migração de colunas de mídia.', a: 'session' },
      { m: 'POST', p: '/api/admin/migrate-fee-config', d: 'Migração para modelo de taxas flexíveis.', a: 'session' },
      { m: 'POST', p: '/api/admin/mp-diagnostic', d: 'Diagnóstico da integração Mercado Pago.', a: 'session' },
    ],
  },
  {
    id: 'maintenance', icon: '🧰', title: 'Manutenção (temporários)',
    desc: 'Migrations pontuais e diagnóstico — uso restrito a deploy/firmino.',
    endpoints: [
      { m: 'POST', p: '/api/migrate/add-payment-columns', d: 'Adiciona colunas de pagamento.', a: 'session' },
      { m: 'POST', p: '/api/migrate/mp-columns', d: 'Adiciona colunas do Mercado Pago.', a: 'session' },
      { m: 'POST', p: '/api/migrate/mp-oauth-columns', d: 'Adiciona colunas OAuth do MP.', a: 'session' },
      { m: 'POST', p: '/api/payments/diag', d: 'Diagnóstico de cobranças.', a: 'session' },
      { m: 'POST', p: '/api/payments/diag-noauth', d: 'Diagnóstico sem sessão (temporário).', a: 'public' },
      { m: 'POST', p: '/api/payments/fix-pix-key', d: 'Correção de chave PIX.', a: 'session' },
      { m: 'POST', p: '/api/contacts/init-table', d: 'Inicialização da tabela de contatos.', a: 'session' },
      { m: 'POST', p: '/api/contacts/add-scope', d: 'Adiciona scope OAuth de contatos.', a: 'session' },
      { m: 'GET', p: '/api/debug', d: 'Debug de ambiente (restrito).', a: 'session' },
      { m: 'POST', p: '/api/test/seed-plans', d: 'Popula planos de teste.', a: 'session' },
      { m: 'GET', p: '/api/test/set-plan', d: 'Define plano de teste para um tenant.', a: 'session' },
      { m: 'POST', p: '/api/admin/remove-rita', d: 'Limpeza pontual de registro legado.', a: 'session' },
    ],
  },
]

export function countEndpoints() {
  return API_DOC_CATEGORIES.reduce((n, c) => n + c.endpoints.length, 0)
}

export const AUTH_LABELS = {
  'api-key': { label: 'Chave API', color: '#a78bfa' },
  'session': { label: 'Sessão', color: '#94a3b8' },
  'meta': { label: 'Meta', color: '#34d399' },
  'mp': { label: 'MP', color: '#fbbf24' },
  'public': { label: 'Pública', color: '#64748b' },
}

export const METHOD_COLORS = {
  GET: '#10b981',
  POST: '#38bdf8',
  PATCH: '#f59e0b',
  PUT: '#818cf8',
  DELETE: '#f87171',
}
