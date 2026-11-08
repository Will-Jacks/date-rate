# Date Rate

Diário de dates a dois. Cada date vira um card com foto de capa, e cada pessoa
dá uma nota de **1 a 10**. A nota do outro só aparece depois que você avalia.

**Stack:** Next.js 16 (App Router, PWA) · Tailwind CSS 4 · TanStack Query · Supabase (Auth, Postgres com RLS, Storage, Realtime) · Web Push · Leaflet/OpenStreetMap

## O que o app faz

- **Feed** de cards 4:5 com busca, ordenação, filtros e etiquetas; toque duplo favorita
- **Notas de 1 a 10 ocultas** até os dois avaliarem, com frases de comparação, confete e critérios opcionais (comida, ambiente, preço, vibe) num gráfico de radar
- **Conversa** em cada date, com reações em emoji (inclusive na nota do outro)
- **Tempo real** e **notificações push**: nota nova, date novo, comentário, date marcado, lembretes
- **Planos**: dates marcados com contagem regressiva, roleta para sortear o próximo e lista "Queremos ir"
- **Busca de lugares** (OpenStreetMap) que preenche endereço, mapa e tipo do date
- **Mapa** com os dates; **revisitas** do mesmo lugar com a evolução da nota
- **Nós**: estatísticas, medalhas, sequência de semanas, orçamento do mês e **Retrospectiva** anual no estilo stories
- **"Num dia como hoje"**, **card para compartilhar nos stories**, **esqueci minha senha**, **modo offline**, tema escuro

## Como colocar no ar

### 1. Supabase
1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode **na ordem** cada arquivo de [`supabase/migrations/`](supabase/migrations/)
   (`0001_init.sql` → `0005_features.sql`): cole o conteúdo e clique em **Run**.
   Todos podem ser rodados de novo sem problema.
3. Em **Authentication → Sign In / Providers → Email**, desative **Confirm email**.
4. Em **Authentication → URL Configuration → Redirect URLs**, adicione
   `http://localhost:3000/**` e `https://SEU-APP.vercel.app/**` (usado pelo "Esqueci minha senha").
5. Depois que vocês dois criarem as contas, desative **Allow new users to sign up**.

### 2. Variáveis de ambiente
Copie `.env.example` para `.env.local` e preencha:

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → *Publishable key* |
| `SUPABASE_SECRET_KEY` | Supabase → Project Settings → API Keys → *Secret key* (**só no servidor**) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:` com um e-mail de contato |
| `CRON_SECRET` | qualquer senha longa e aleatória |

### 3. Rodar localmente
```bash
npm install
npm run dev        # http://localhost:3000
npm test           # testes do banco (PGlite), regras do app e envio de push
```

### 4. Publicar (Vercel)
1. Importe o repositório em [vercel.com](https://vercel.com/new).
2. Adicione **todas** as variáveis da tabela acima.
3. O `vercel.json` agenda o lembrete diário (`/api/cron/reminders`, 9h de Brasília).
4. Abra o link no celular e instale:
   - **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*, depois abra pelo ícone
   - **Android (Chrome):** menu ⋮ → *Instalar app*
5. Em **Nós → Notificações**, toque em **Ativar notificações** em cada celular. Chega uma notificação de teste.

> No iPhone, as notificações só funcionam com o app aberto pelo ícone da Tela de Início (iOS 16.4+).

## Primeiro uso
1. Uma pessoa cria a conta e toca em **Criar nosso diário**. O app mostra um código de 6 letras.
2. A outra pessoa cria a conta, toca em **Tenho um código** e digita esse código.
3. A partir daí, tudo o que um registra aparece para o outro.

## Como funciona

| Regra | Onde é garantida |
|---|---|
| Cada casal só vê os próprios dados e fotos | RLS em todas as tabelas e no Storage (`my_couple_id()`) |
| No máximo 2 pessoas por casal | RPC `join_couple` |
| A nota (e os critérios) do par ficam ocultos até você avaliar | RLS em `ratings` e RPC `get_dates` |
| O par é avisado mesmo com a nota oculta | trigger que "toca" o date a cada nota (Realtime) + `/api/notify` |
| Notificações não podem ser forjadas | `/api/notify` confere o usuário e monta o texto a partir do banco |
| Fotos privadas | bucket privado com URLs assinadas; offline, o service worker guarda as já vistas |
| Fotos leves e sem GPS | comprimidas no navegador (1600px, JPEG 82%); regravar remove o EXIF |

## Estrutura
```
src/
  app/
    login/ · reset/ · onboarding/
    (app)/                   área logada (sessão + casal)
      page.tsx               feed
      dates/new · [id] · [id]/edit
      wishlist/              Planos: dates marcados, roleta, "Queremos ir"
      map/                   mapa dos dates
      profile/               Nós: medalhas, sequência, orçamento, ajustes
      retro/                 retrospectiva do ano
    api/notify               envia push para o par
    api/cron/reminders       lembretes diários dos dates marcados
  components/                UI
  lib/
    api.ts                   todo acesso ao Supabase
    hooks.ts · realtime.ts   dados e tempo real (TanStack Query)
    insights.ts              medalhas, sequência, retrospectiva… (puro, testado)
    push.ts · server/push.ts notificações (navegador / servidor)
    places.ts                busca de lugares (Photon/OpenStreetMap)
public/sw.js                 service worker: push + offline
supabase/migrations/         schema SQL
tests/                       vitest: banco (PGlite), lógica, push
```
