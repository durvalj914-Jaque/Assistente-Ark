# 🤖 Assistente Ark — SaaS WhatsApp Business

Plataforma multi-tenant para criação e gestão de bots WhatsApp Business.

## Stack
- **Frontend/Backend:** Next.js 14 (Vercel)
- **Banco de dados:** Supabase (PostgreSQL + RLS)
- **Auth:** Supabase Auth
- **WhatsApp:** Meta Business API
- **Pagamentos:** Stripe (pronto para integrar)

## Estrutura
```
pages/
  login.js             → Auth (login + cadastro)
  admin/
    index.js           → Dashboard
    bots.js            → Gestão de bots
    flow.js            → Editor de fluxo visual
    conversations.js   → Conversas em tempo real
    contacts.js        → Contatos
    analytics.js       → Métricas
    settings.js        → Config + membros + plano
    upgrade.js         → Planos e upgrade
  client/
    index.js           → Portal do cliente
  api/
    webhook/[botId].js → Webhook Meta (multi-bot)

components/
  Layout/AdminLayout.js → Sidebar + layout admin
  FlowEditor/index.js   → Editor de fluxo visual

lib/
  supabase.js     → Client Supabase (browser + admin)
  meta.js         → Meta WhatsApp API
  flowEngine.js   → Engine do fluxo
  plans.js        → Definição de planos
  auth.js         → Helpers de auth

hooks/
  useTenant.js    → Hook: user + tenant + bots
```

## Deploy

### 1. Supabase
1. Crie um projeto em supabase.com
2. Execute o `supabase-schema.sql` no SQL Editor
3. Em Authentication > Settings: habilite confirmação por e-mail (opcional para dev)

### 2. Vercel
1. Importe o repo `Assistente-Ark` no Vercel
2. Configure as Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   NEXT_PUBLIC_APP_URL
   ```
3. Deploy!

### 3. Meta Webhook
Para cada bot, configure no Meta Business:
- **URL:** `https://seu-app.vercel.app/api/webhook/{BOT_ID}`
- **Verify Token:** o que você configurou no bot

### 4. Planos & Stripe
- Edite `lib/plans.js` para ajustar preços e limites
- Conecte o Stripe na página `/admin/upgrade`

## Acesso
- Cadastro/Login: `/login`
- Admin: `/admin`
- Cliente: `/client`

## Multi-tenant
Cada empresa que se cadastra ganha automaticamente:
- Tenant próprio (isolado por RLS)
- Bot padrão criado
- Plano Free com 1.000 mensagens/mês
