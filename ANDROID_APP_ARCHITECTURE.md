# Arquitetura do App Android Nativo — Assistente Ark (Painel)

Contexto: já existe um backend em produção (Next.js na Vercel + Supabase Postgres/Auth) rodando em `https://arkiel.com.br`. Este app Android é um **cliente nativo** desse mesmo backend — não recria nada, só consome. Login com a MESMA conta Google que já usam no painel web, mesmos dados, tempo real.

---

## 1. Visão geral da stack

- **Linguagem:** Kotlin, Jetpack Compose (UI), arquitetura MVVM.
- **Auth:** Google Sign-In (Credential Manager API) → troca do idToken com o Supabase Auth (mesmo projeto do painel web).
- **Dados:** SDK oficial `supabase-kt` (Postgrest direto nas tabelas, respeitando RLS — as mesmas regras de segurança que já protegem o painel web protegem o app).
- **Ações privilegiadas:** chamadas HTTP para os endpoints já existentes em `https://arkiel.com.br/api/...` (mesmo padrão que o próprio painel web usa).
- **Push nativo:** Firebase Cloud Messaging (FCM) — é o único mecanismo confiável de notificação push nativa no Android, inclusive com o app fechado.

---

## 2. Credenciais e configuração (o que você precisa colocar)

### 2.1 Supabase (mesmo projeto do painel web)
```
SUPABASE_URL = https://oiautldzswsncsgzqmhe.supabase.co
SUPABASE_ANON_KEY = <pegar em Supabase Dashboard → Project Settings → API → anon/public key>
```
A anon key **não é secreta** — é a mesma usada no frontend web, protegida pelas políticas de RLS do banco. Pode ir direto no `BuildConfig` do app.

### 2.2 API do painel (Next.js)
```
API_BASE_URL = https://arkiel.com.br/api
```

### 2.3 Firebase (você precisa criar — passos exatos)
1. Vá em https://console.firebase.google.com → **Adicionar projeto** (pode reusar um existente ou criar um novo, ex: "Assistente Ark").
2. Dentro do projeto, **Adicionar app → Android**.
3. **Nome do pacote (package name):** escolha um e USE O MESMO no `applicationId` do `build.gradle.kts` do app. Sugestão: `br.com.arkiel.painel`.
4. Baixe o `google-services.json` gerado e coloque em `app/google-services.json` no projeto Android Studio.
5. Adicione o plugin do Google Services no Gradle (veja seção 6).
6. **Importante — isso você me manda de volta, não fica no app:** vá em ⚙️ **Configurações do projeto → Contas de serviço → Firebase Admin SDK → Gerar nova chave privada**. Isso baixa um JSON. Me envie esse JSON (vou pedir via um formulário seguro) — é o que uso no backend pra CONSEGUIR MANDAR as notificações pro seu celular. Sem isso, o app até registra o token, mas o servidor não consegue disparar nada.

---

## 3. Fluxo de autenticação (Google → Supabase)

1. App dispara o Google Sign-In nativo (Credential Manager / `GoogleIdTokenCredential`), usando o **mesmo OAuth Client ID (Web)** já configurado no Google Cloud Console pro projeto Arkiel (o mesmo que o Supabase usa pro login do painel web — pegar em Supabase Dashboard → Authentication → Providers → Google → "Client ID").
2. Com o `idToken` retornado pelo Google, chama:
   ```kotlin
   supabase.auth.signInWith(IDToken) {
       idToken = googleIdToken
       provider = Google
   }
   ```
3. Isso cria/reaproveita a MESMA sessão Supabase que o painel web usa — o backend já tem um trigger (`handle_new_user_tenant`) que garante que todo usuário Google tem um tenant vinculado automaticamente.
4. Guarde a sessão com o `supabase-kt` (ele já persiste local + auto-refresh do token).
5. Toda chamada às APIs do painel (`/api/...`) deve mandar `Authorization: Bearer <session.accessToken>`.

---

## 4. Resolver o tenant do usuário logado

Depois do login, primeira coisa a fazer (o painel web faz isso via `useTenant.js`):
```kotlin
val member = supabase.from("tenant_members")
    .select { filter { eq("user_id", currentUserId) } }
    .decodeSingle<TenantMember>() // contém tenant_id e role

val tenant = supabase.from("tenants")
    .select { filter { eq("id", member.tenantId) } }
    .decodeSingle<Tenant>()
```
Guarde `tenant.id` na sessão do app (ViewModel/DataStore) — é o filtro usado em todas as queries seguintes.

---

## 5. Telas e dados (schema real das tabelas — mesma fonte do painel web)

**IMPORTANTE:** ao fazer `select` na tabela `bots`, NUNCA peça a coluna `access_token` (é o segredo da Meta API, o próprio painel web já foi corrigido pra nunca vazar isso pro frontend). Sempre liste colunas explícitas.

### 5.1 Tela de Conversas (principal — é onde o handoff humano aparece)
```kotlin
supabase.from("conversations")
    .select(columns = Columns.list("id,status,current_node_id,last_message,last_message_at,contact_id,bot_id")) {
        filter { eq("tenant_id", tenantId); neq("status", "closed") }
        order("last_message_at", Order.DESCENDING)
    }
```
Campo `status`: `"bot"` (IA respondendo), `"human"` (⚠️ esperando atendimento — é o gatilho da notificação), `"closed"`.

Pra trocar de volta pra bot ou marcar como atendida manualmente, chama a API existente (mesmo endpoint do painel web):
```
POST https://arkiel.com.br/api/toggle-mode
Headers: Authorization: Bearer <token>
Body: { "conversation_id": "...", "mode": "bot" | "human" }
```

### 5.2 Mensagens de uma conversa
```kotlin
supabase.from("messages")
    .select { filter { eq("conversation_id", conversationId) }; order("created_at", Order.ASCENDING) }
```
Campos: `direction` (`inbound`=cliente, `outbound`=bot/humano), `content`, `type`, `created_at`.

Pra responder manualmente do app (assumir a conversa como humano), usar o endpoint existente:
```
POST https://arkiel.com.br/api/send-message
Headers: Authorization: Bearer <token>
Body: { "conversation_id": "...", "text": "..." }
```
(conferir o contrato exato desse endpoint em `pages/api/send-message.js` do repositório — ele já cuida de enviar pra Meta API e salvar no banco.)

### 5.3 Contatos
```kotlin
supabase.from("contacts")
    .select { filter { eq("tenant_id", tenantId) }; order("created_at", Order.DESCENDING) }
```
Campos: `phone, name, email, tags, opt_in, created_at`.

### 5.4 Bots (status/nome — SEM access_token)
```kotlin
supabase.from("bots")
    .select(columns = Columns.list("id,name,status,phone_number_id,total_messages,active_sessions")) {
        filter { eq("tenant_id", tenantId) }
    }
```

### 5.5 Tempo real (opcional, mas recomendado)
`supabase-kt` suporta Realtime — inscreva-se em mudanças de `conversations` filtradas por `tenant_id` pra atualizar a lista ao vivo sem precisar de pull-to-refresh:
```kotlin
val channel = supabase.realtime.channel("conversations-$tenantId")
channel.postgresChangeFlow<PostgresAction>(schema = "public") {
    table = "conversations"
    filter = "tenant_id=eq.$tenantId"
}.onEach { /* atualizar UI */ }.launchIn(viewModelScope)
channel.subscribe()
```

---

## 6. Push nativo (Firebase Cloud Messaging) — o coração do pedido original

### 6.1 Dependências (Gradle - `app/build.gradle.kts`)
```kotlin
plugins {
    id("com.google.gms.google-services") // no build.gradle.kts do projeto (nível raiz): classpath do plugin
}

dependencies {
    implementation(platform("com.google.firebase:firebase-bom:33.1.0"))
    implementation("com.google.firebase:firebase-messaging-ktx")
    implementation("io.github.jan-tennert.supabase:postgrest-kt:2.5.4")
    implementation("io.github.jan-tennert.supabase:auth-kt:2.5.4")
    implementation("io.github.jan-tennert.supabase:realtime-kt:2.5.4")
    implementation("io.ktor:ktor-client-android:2.3.11")
    implementation("androidx.credentials:credentials:1.2.2")
    implementation("androidx.credentials:credentials-play-services-auth:1.2.2")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
}
```

### 6.2 AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" /> <!-- obrigatório Android 13+ -->
<uses-permission android:name="android.permission.VIBRATE" />

<service android:name=".push.ArkFirebaseMessagingService" android:exported="false">
    <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT" />
    </intent-filter>
</service>
```
Peça a permissão `POST_NOTIFICATIONS` em runtime (Android 13+) na tela inicial, senão a notificação não aparece.

### 6.3 Canal de notificação (som + vibração) — criar no `Application.onCreate()`
```kotlin
val channel = NotificationChannel(
    "ark_human_handoff",
    "Atendimento humano solicitado",
    NotificationManager.IMPORTANCE_HIGH
).apply {
    enableVibration(true)
    vibrationPattern = longArrayOf(0, 300, 150, 300, 150, 300)
    enableLights(true)
    setSound(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION), AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION).build())
}
getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
```
**Crucial:** o `channelId` aqui (`ark_human_handoff`) tem que ser IDÊNTICO ao que o backend manda no payload FCM (já configurado assim em `lib/fcm.js` do backend).

### 6.4 Service que recebe o push
```kotlin
class ArkFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        // Envia o token novo pro backend sempre que for gerado/atualizado
        CoroutineScope(Dispatchers.IO).launch { registerTokenWithBackend(token) }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title ?: "👤 Cliente pediu atendimento humano"
        val body = message.notification?.body ?: ""
        val url = message.data["url"] ?: "/admin/conversations"
        showNotification(title, body, url) // NotificationCompat.Builder com channelId "ark_human_handoff"
    }
}
```

### 6.5 Registrar o token no backend (logo após login e sempre que `onNewToken` disparar)
```
POST https://arkiel.com.br/api/push/register-fcm
Headers: Authorization: Bearer <supabase_session_token>
Body: { "token": "<fcm_token>" }
```
Esse endpoint **já está no ar**, esperando por vocês. Ele resolve o tenant automaticamente pelo usuário logado — não precisa mandar tenant_id.

No logout, chamar:
```
POST https://arkiel.com.br/api/push/unregister-fcm
Body: { "token": "<fcm_token>" }
```

### 6.6 O que já está pronto do lado do servidor (não precisa fazer nada aqui)
Toda vez que um cliente do WhatsApp digitar a palavra-chave de humano OU cair num nó de transferência no fluxo, o backend automaticamente:
1. Marca a conversa como `status: 'human'` no banco.
2. Dispara push via Web Push (navegador) **e** via FCM (app Android) — em paralelo, pros dois canais que estiverem registrados.

O envio real só vai funcionar assim que vocês me passarem o JSON do service account do Firebase (seção 2.3, passo 6).

---

## 7. Estrutura de pastas sugerida

```
app/src/main/java/br/com/arkiel/painel/
├── ArkApplication.kt           // cria o notification channel aqui
├── data/
│   ├── SupabaseClient.kt       // instancia única do createSupabaseClient
│   ├── ApiClient.kt            // Ktor/Retrofit pra chamadas em /api/*
│   └── models/                 // Tenant, Bot, Contact, Conversation, Message
├── auth/
│   ├── GoogleAuthManager.kt    // Credential Manager + troca com Supabase
│   └── SessionRepository.kt
├── push/
│   └── ArkFirebaseMessagingService.kt
├── ui/
│   ├── login/
│   ├── conversations/          // lista + detalhe/chat
│   ├── contacts/
│   └── settings/                // status de notificações, logout
└── viewmodel/
```

---

## 8. Resumo do que falta de cada lado

**Você faz no Android Studio (com o Gemini):** todo o app Kotlin acima.

**Você precisa me mandar:** o JSON da service account do Firebase (seção 2.3, passo 6) — assim que tiver, eu configuro no servidor e o push nativo passa a funcionar de ponta a ponta.

**Eu já fiz:** tabela `fcm_tokens` no banco, endpoints `/api/push/register-fcm` e `/api/push/unregister-fcm`, e o disparo de notificação (`lib/fcm.js`) já integrado nos dois pontos do webhook onde a conversa vira "human" — tudo em produção, só esperando a chave do Firebase.
