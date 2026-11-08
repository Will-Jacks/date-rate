# Date Rate — Conceito inicial

> Resumo importado da conversa "App de avaliação de dates" (claude.ai, 2026-11-08).

## Produto
Diário visual do casal: cada date vira um card (foto, local, data) com avaliações
**individuais** dos dois. A nota do outro só aparece depois que você avalia.

**MVP**
- Feed de cards (foto de capa, título do local e data sobre gradiente escuro)
- Criar date: foto de capa (+ extras), local, data, categoria, custo (opcional)
- Avaliação individual: nota + comentário curto, nota do parceiro oculta até você avaliar
- Detalhe: galeria, as duas avaliações, média do casal

**v2**: critérios separados (comida, ambiente, preço, vibe) · lista "Queremos ir" ·
mapa · retrospectiva anual · "Num dia como hoje"

## Design
- Card 4:5, cantos de 16px, gradiente preto de baixo para cima; nome do local em fonte grande
- Fundo creme `#FAF7F2`, cor principal vinho/coral; títulos em Fraunces/Playfair, texto em Inter
- Navegação: Feed · Novo date (botão central) · Queremos ir / Perfil
- Microinterações: revelar a nota do parceiro, toque duplo para favoritar

## Arquitetura
- Frontend: **Next.js (PWA)** se algum dos dois usa iPhone; Expo se os dois usam Android
- Backend: Supabase (Auth com magic link, Storage `date-photos`, Postgres + RLS)
- Imagens comprimidas no aparelho (~1080px, WebP/JPEG 80%)

```sql
couples      (id, name, created_at)
profiles     (id → auth.users, couple_id, display_name, avatar_url)
dates        (id, couple_id, created_by, title, place_name, place_address,
              date_on, category, cost, cover_photo_path, created_at)
date_photos  (id, date_id, path, position)
ratings      (id, date_id, user_id, score, comment, created_at,
              unique(date_id, user_id))
wishlist     (id, couple_id, place_name, notes, added_by, done_date_id)
```

- RLS: cada usuário só acessa dados do próprio `couple_id`
- A nota do parceiro vem de uma view/função que só a devolve se você já avaliou

## Decisões tomadas
1. Nota de **1 a 10**; as notas ficam **ocultas até os dois avaliarem**
2. Frontend: **aplicação web** (Next.js como PWA)
3. Primeiro passo: protótipo visual em `prototype/index.html`
4. Login com e-mail e senha (magic link não funciona bem em PWA instalada no iPhone)
5. O casal é formado com um código de convite de 6 letras (máximo 2 pessoas)
6. A lista "Queremos ir" e as estatísticas no perfil entraram já no MVP
