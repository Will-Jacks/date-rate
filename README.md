# Date Rate

Diário de dates a dois. Cada date vira um card com foto de capa, e cada pessoa
dá uma nota de **1 a 10**. A nota do outro só aparece depois que você avalia.

**Stack:** Next.js 16 (App Router, PWA) · Tailwind CSS 4 · TanStack Query · Supabase (Auth, Postgres com RLS, Storage)

## Como colocar no ar

### 1. Supabase
1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, rode, na ordem, cada arquivo de [`supabase/migrations/`](supabase/migrations/) (`0001_init.sql`, `0002_leave_couple.sql`…): cole o conteúdo e clique em **Run**.
   O script cria as tabelas, as regras de acesso (RLS), as funções e o bucket privado `date-photos`.
3. Em **Authentication → Sign In / Providers → Email**, desative **Confirm email**.
   Assim a conta funciona na hora, sem precisar abrir o link de confirmação.
4. Depois que vocês dois criarem as contas, desative **Allow new users to sign up**.
   Com isso, mais ninguém consegue se cadastrar.

### 2. Rodar localmente
```bash
cp .env.example .env.local   # preencha com Project Settings → API (URL e Publishable key)
npm install
npm run dev
```
Abra http://localhost:3000.

### 3. Publicar (Vercel)
1. Importe o repositório em [vercel.com](https://vercel.com/new).
2. Adicione as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
3. Faça o deploy e abra o link no celular:
   - **iPhone (Safari):** Compartilhar → *Adicionar à Tela de Início*
   - **Android (Chrome):** menu ⋮ → *Instalar app*

## Primeiro uso
1. Uma pessoa cria a conta e toca em **Criar nosso diário**. O app mostra um código de 6 letras.
2. A outra pessoa cria a conta, toca em **Tenho um código** e digita esse código.
3. A partir daí, tudo o que um registra aparece para o outro.

## Como funciona

| Regra | Onde é garantida |
|---|---|
| Cada casal só vê os próprios dados e fotos | RLS em todas as tabelas e no Storage (`my_couple_id()`) |
| No máximo 2 pessoas por casal | RPC `join_couple` |
| A nota do par fica oculta até você avaliar | RLS em `ratings` e na RPC `get_dates`, que devolve `partner_score` só se você já avaliou |
| A média só aparece quando os dois avaliaram | `get_dates.couple_avg` |
| Fotos privadas | Bucket privado com URLs assinadas válidas por 1h |
| Fotos leves e sem GPS | Comprimidas no navegador (1600px, JPEG 82%); regravar a imagem remove o EXIF |

## Estrutura
```
src/
  app/
    login/            entrar / criar conta
    onboarding/       criar casal ou entrar com código
    (app)/            área logada (exige sessão e casal)
      page.tsx        feed de cards
      dates/new       novo date
      dates/[id]      detalhe + avaliação
      dates/[id]/edit editar / apagar
      wishlist/       "Queremos ir"
      profile/        nome, convite, estatísticas, sair
    manifest.ts       PWA
  components/         UI (card, painel de notas, formulário…)
  lib/
    api.ts            todo acesso ao Supabase (erros viram AppError)
    hooks.ts          queries e mutações (TanStack Query)
    images.ts         compressão de fotos
supabase/migrations/  schema SQL
prototype/            protótipo visual estático (referência)
```
