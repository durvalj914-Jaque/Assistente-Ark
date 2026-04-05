# 🚀 Setup do Assistente Ark

## Banco de Dados (Supabase)

O projeto já está conectado ao Supabase. Para criar as tabelas:

1. Acessa [supabase.com/dashboard](https://supabase.com/dashboard)
2. Abre o projeto **oiautldzswsncsgzqmhe**
3. Vai em **SQL Editor**
4. Cola o conteúdo do arquivo `supabase-schema.sql`
5. Clica em **Run**

## Variáveis de Ambiente

As variáveis já estão configuradas no `.env.example`. Para rodar localmente:

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Deploy na Vercel

1. Conecta o repo na Vercel
2. Adiciona as variáveis de ambiente do `.env.example`
3. Faz o deploy!
