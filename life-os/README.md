# Life OS

Sistema pessoal de rotina e disciplina: hábitos, agenda, casa, sono, foco, tempo de tela, metas, diário e estatísticas. PWA instalável no iPhone e no computador, dark mode por padrão, português do Brasil, fuso `America/Sao_Paulo`.

## Stack

- Next.js 16 (App Router, Turbopack, Proxy) + React 19 + TypeScript
- Tailwind CSS 4 + componentes no padrão shadcn/ui (Radix) + Lucide
- Supabase (Auth + Postgres com RLS)
- Recharts, date-fns / date-fns-tz, Zod, react-hook-form, web-push, Vitest

## Rotas

| Rota | O que faz |
|---|---|
| `/dashboard` | Saudação, indicador do dia, resumo de hábitos/tarefas, próximo compromisso, sono/foco/tela, timeline manhã-tarde-noite, prioridades, ações rápidas |
| `/habitos`, `/habitos/[id]` | CRUD, pausar/arquivar/reordenar, tipos sim-não/quantidade/duração, frequência (diária, dias da semana, X por semana), sequências, taxas, heatmap, registro retroativo, dia justificado |
| `/tarefas` | Tarefas com prazo, subtarefas, prioridades do dia, adiamento (contado) |
| `/agenda` | Dia, semana, mês e lista; recorrência (diária/semanal/mensal/anual, intervalo, até, nº de vezes), exceções, remarcação por arrastar |
| `/casa` | Tarefas domésticas com periodicidade, checklist, conclusão parcial, próxima data, atrasadas, rotina semanal |
| `/sono` | Metas, rotinas noturna/matinal, registros manuais, duração, consistência, médias, meta cumprida |
| `/foco` | Pomodoro, personalizado, progressivo, “sem redes sociais”; interrupções; relatórios dia/semana/mês |
| `/bem-estar-digital` | Tempo de tela **informado manualmente** por app, metas por app, comparação, gráficos, redução, uso excessivo, uso consciente |
| `/metas` | Metas numéricas e de conclusão, progresso com histórico, hábitos relacionados |
| `/estatisticas` | Taxas, totais, comparação semanal, tendências e **resumo semanal determinístico** (sem IA) |
| `/diario` | Entrada por dia (humor, energia, coisas boas, melhorar, aprendizados, prioridades) com busca full-text |
| `/configuracoes` | Perfil, fuso, tema, início da semana, períodos do dia, hábitos da tela inicial, lembretes e Web Push, categorias, exportar/importar/apagar dados, conta |
| `/onboarding` | Rotina de exemplo editável (manhã/tarde/noite) + horários de sono |

## Rodar localmente

```bash
cd life-os
npm install
cp .env.example .env.local   # preencha as variáveis (veja abaixo)
npm run dev                  # http://localhost:3000
```

Sem `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` o app abre `/configurar` com instruções.

Outros comandos: `npm run build`, `npm run lint`, `npm run typecheck`, `npm test` (recorrência, fuso horário, hábitos, sono, estatísticas).

## Configurar o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute `supabase/migrations/0001_schema.sql` (ou `supabase db push` com a CLI). Ele cria todas as tabelas, índices, políticas RLS, o trigger que cria o perfil ao cadastrar e as funções `delete_my_data` / `delete_my_account`.
3. Em **Authentication › Providers**, mantenha *Email* habilitado. Em **Authentication › URL Configuration** adicione:
   - Site URL: `http://localhost:3000` (e a URL da Vercel em produção)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://SEU-APP.vercel.app/auth/callback`
4. Em **Project Settings › API** copie a URL, a `anon` key e a `service_role` key para o `.env.local`.

Variáveis:

| Variável | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente e servidor (sujeitos a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Somente servidor**: envio agendado de push (`/api/cron/reminders`) |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | Web Push. Gere com `npm run vapid` |
| `CRON_SECRET` | Protege o endpoint do agendador (a Vercel envia automaticamente) |
| `NEXT_PUBLIC_APP_URL` | URL pública, usada nos links de confirmação de e-mail |

Cada usuário só acessa os próprios dados (`auth.uid() = user_id` em todas as políticas). Nenhuma chave privilegiada vai para o cliente.

## Notificações (Web Push)

- O service worker (`public/sw.js`) recebe o push e abre a página certa ao tocar.
- As assinaturas ficam em `push_subscriptions`; o agendador roda a cada 5 min (`vercel.json`) e envia lembretes de hábitos, compromissos (antecedência configurável), hora de dormir, rotina noturna/matinal e tarefas atrasadas. Cada lembrete tem uma chave única em `notification_log`, então nunca é enviado duas vezes.
- **iPhone:** requer iOS 16.4+, app adicionado à Tela de Início pelo Safari e aberto pelo ícone. Na aba do Safari não há push.
- Alertas do cronômetro de foco usam notificações locais e som **apenas com o site aberto**; não são substitutos de push.

## Publicar na Vercel

1. Importe o repositório e defina **Root Directory** = `life-os`.
2. Adicione todas as variáveis acima em *Environment Variables* (inclusive `CRON_SECRET`; a Vercel usa esse valor no cron).
3. Deploy. O cron de lembretes é lido de `vercel.json`.
4. Atualize no Supabase a Site URL e as Redirect URLs com o domínio da Vercel.

## PWA

- `manifest.webmanifest` gerado em `src/app/manifest.ts`; ícones em `public/icons`.
- Instalação: iPhone (Safari › Compartilhar › Adicionar à Tela de Início) e desktop (ícone de instalação no Chrome/Edge).
- Modo standalone, safe areas do iPhone, menu inferior com 5 destinos e acesso às demais áreas por “Mais”.
- O service worker cacheia estáticos; páginas autenticadas são sempre buscadas da rede (fallback `/offline`). Não há escrita offline: as ações mostram erro de rede e podem ser repetidas sem duplicar (operações idempotentes por chave única).

## Honestidade dos dados

- Sono e tempo de tela são **informados manualmente**. O app não monitora nada automaticamente.
- O tempo de foco é **medido no site** pelo cronômetro.
- Um site não tem acesso ao Tempo de Uso do iOS. A tabela `screen_time_logs` tem a coluna `source` (`manual` | `measured` | `imported`) e `src/lib/screen-time/index.ts` define a interface `ScreenTimeProvider` para uma eventual integração nativa (Screen Time API / FamilyControls / DeviceActivity), que exigiria entitlement da Apple, consentimento e revisão de privacidade. Nada contorna restrições do iOS.

## Estrutura

```
src/app            rotas (grupo (auth), grupo (app), api/, onboarding, offline)
src/components     ui/ (design system), layout/, e um diretório por área
src/lib/actions    Server Actions validadas com Zod
src/lib/data       carregadores de dados por página
src/lib/{dates,recurrence,habits,sleep,stats,focus,home,screen-time}  lógica pura (testada)
src/lib/push       envio de push e agendador
supabase/migrations/0001_schema.sql
tests/             Vitest
```
