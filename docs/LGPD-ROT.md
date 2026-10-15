# Registro das Operações de Tratamento (ROT) — Assistente Ark

Última revisão: 15/10/2026 · Controladora: Arkiel Tecnologia · Encarregado (DPO): arkieltech@gmail.com

Documento interno exigido pelo art. 37 da LGPD. Mapeia cada operação de tratamento:
dado → onde mora → finalidade → base legal → retenção → compartilhamento.

## 1. Titulares e papéis

| Titular | Papel |
|---|---|
| Usuário da plataforma (cliente B2B) | Titular perante a Arkiel (controladora) |
| Contato final (quem conversa com o bot) | Titular perante o cliente; a Arkiel atua como **operadora** |
| Equipe Arkiel (platform admin) | Acesso por necessidade de conhecer, com logs de acesso |

## 2. Operações de tratamento

| # | Operação | Dados | Onde mora (tabela/fornecedor) | Finalidade | Base legal (LGPD) | Retenção | Compartilhamento |
|---|---|---|---|---|---|---|---|
| 1 | Criação de conta | Nome, e-mail, foto Google | `profiles` (Supabase); `auth.users` | Identificação e acesso | Execução de contrato (art. 7º V) | Enquanto conta ativa | Google (OAuth) |
| 2 | Gestão da empresa | Nome, plano, membros | `tenants`, `tenant_members` | Prestação do serviço | Execução de contrato | Enquanto conta ativa | — |
| 3 | Conexão WhatsApp | phone_number_id, WABA ID, nome verificado, access_token | `bots` (token cifrado em env, não no banco) | Envio/recebimento de mensagens | Execução de contrato | Enquanto número conectado | Meta (WhatsApp Business API) |
| 4 | Atendimento por bot | Telefone, nome de perfil, conteúdo das mensagens | `contacts`, `conversations`, `messages` | Responder e registrar atendimento pedido pelo titular final | Execução de contrato/tutela de saúde em agendamentos (art. 7º V; art. 11 II f) | Enquanto contrato do cliente ativo | Meta (transporte da mensagem) |
| 5 | Catálogo e vendas | Produtos, pedidos, itens | `products`, `whatsapp_orders` | Venda pelo bot | Execução de contrato | Enquanto contrato ativo | Meta (catálogo) |
| 6 | Pagamentos | Valor, status, PIX, telefone do comprador | `payments`, `payment_receipts`, `payment_accounts` | Cobrança e repasse (ACP/split) | Execução de contrato + obrigação legal (fiscal) | Prazo legal fiscal (5 anos) | Mercado Pago |
| 7 | Agendamentos | Nome, telefone, serviço, data/hora | `appointments`, `booking_settings`, `schedule_blocks`, `calendar_connections` | Agendar e lembrar atendimento | Execução de contrato; tutela da saúde p/ clínicas | Enquanto contrato ativo | Google Agenda (se conectado) |
| 8 | Inteligência artificial (BYOK) | Mensagem recebida + contexto (produtos, horários) | Em memória no processamento; chave do provedor em `ai_settings` (AES-256-GCM) | Responder fora do menu | Execução de contrato (art. 7º V) | Sem armazenamento adicional | Provedor de IA escolhido pelo cliente (OpenAI, Anthropic etc.) |
| 9 | Marketing | Mensagens programadas, janelas de conversa | `marketing_messages`, `conversation_windows` | Campanhas disparadas pelo cliente | Consentimento do contato final (responsabilidade do cliente) | 90 dias (janelas) | Meta |
| 10 | Créditos e faturamento | Compras de crédito, uso, ciclos ACP | `credit_purchases`, `credit_usage_log`, `conversation_credits`, `commission_cycles` | Cobrança e auditoria financeira | Execução de contrato + obrigação legal | Prazo fiscal | Mercado Pago |
| 11 | Analytics | Eventos pseudonimizados por contato (analytics_events com contact_id) | `analytics_events` | Métricas para o cliente | Legítimo interesse (art. 7º IX) | Enquanto contrato ativo | — |
| 12 | Notificações push | Tokens FCM/Web Push | `push_subscriptions`, `fcm_tokens` | Avisar handoff humano | Execução de contrato | Enquanto ativo/renovado | Google (FCM) |
| 13 | Logs técnicos | Payloads de webhook, erros | `webhook_logs` | Diagnóstico e segurança | Legítimo interesse | **30 dias (limpeza automática diária no cron)** | — |
| 14 | Autenticação | Sessões, tokens JWT | Supabase Auth | Manter login | Execução de contrato | Sessão | Supabase |

## 3. Medidas de segurança (art. 46)

- Criptografia AES-256-GCM para chaves de IA e tokens sensíveis; TLS em tráfego.
- RLS multi-tenant em todas as tabelas por `is_tenant_member`.
- Validação de assinatura HMAC nos webhooks (Meta, Mercado Pago).
- Senhas inexistentes (OAuth Google exclusivo).
- Segredos apenas no servidor (Vercel env), nunca no front.

## 4. Fluxo de atendimento a titulares (art. 18)

1. Pedido chega em arkieltech@gmail.com (canal publicado na Política).
2. Identificação do titular: usuário da plataforma (e-mail) ou contato final (telefone + empresa do bot).
3. Exportação: `POST /api/privacy/export` (scope `tenant` ou `contact`).
4. Eliminação: `POST /api/privacy/delete` (scope `contact` ou `tenant` com confirm "EXCLUIR").
5. Resposta ao titular em até 15 dias, com evidência (JSON exportado / steps da exclusão).

## 5. Incidentes (art. 48)

Detecção → conter → avaliar risco aos titulares → se risco relevante: notificar ANPD em até 2 dias úteis e comunicar afetados → registro pós-incidente. Responsável: DPO.

## 6. Revisões

- 15/10/2026 — criação do ROT junto à implementação do Nível 2 (endpoints do titular + retenção de logs).
