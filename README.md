# Questeca

SaaS web (pt-BR) para professores do 6º ano ao Ensino Médio: provas com questões reais alinhadas ao que a turma estudou,
correção, notas, relatórios e documentos da coordenação. Especificação: o PRD v1.0 (ver `docs/PLANO.md` para o plano técnico).

**Stack:** Next.js 15 (App Router) · TypeScript · Postgres (Neon) com Drizzle · Tailwind 4 · pdf-lib / docx · Vitest · Playwright.

## Começar
```bash
pnpm install
cp .env.example .env.local     # preencha DATABASE_URL e AUTH_SECRET
pnpm db:migrate && pnpm db:seed
pnpm dev
```
## Testes
```bash
pnpm test        # 80 testes de regras (filtro, notas, cotas, permissões, gabarito, análise, chat, quiz, gamificação, frequência, agenda)
pnpm build && pnpm start -p 3100   # com .env.test.local apontando para um branch de teste do banco
pnpm e2e         # cenários AV-01..08 e SA-01..10 do PRD + P2, em navegador real; axe WCAG 2.2 AA
```
## Módulos
**Professor e escola** (`/app`): provas com questões reais, correção, notas, relatórios, documentos, comunidade docente, planos e cobrança.
**Rotina escolar** (por turma, em `/app/turmas/[id]`): chamada com correção auditada, tarefas e entregas, mural, quizzes, boletins em PDF, painel pedagógico, engajamento e acessos do portal. Também: agenda (`/app/agenda`), grade de horários com detecção de conflito, mensagens, videoaulas (por link), materiais com aprovação, moderação e gestão acadêmica (`/app/gestao`).
**Portal de alunos e responsáveis** (`/portal`): acesso por link individual de uso único; cada conta vê só o estudante vinculado (tarefas, agenda, notas com fórmula, frequência, mural, mensagens, quizzes, conquistas, boletim, desempenho). A equipe (`requireCtx`) nega o portal por padrão; o portal usa `requirePortal`.
**Regras pela escola** (`/app/escola`): quem pode conversar (aluno só com adulto se a escola permitir; aluno e responsável nunca entre si), horário de atendimento, XP/ranking ligados ou não, limites dos alertas pedagógicos.
Decisões de projeto: XP é um extrato idempotente (`refKey` único por estudante) e nunca diminui; mensagens atualizam por consulta a cada 4 s (sem WebSocket); lembretes de agenda surgem ao abrir o sistema (sem agendador); vídeos são links (YouTube/Vimeo incorporam, outros abrem em nova aba).

## Estrutura
`src/lib/core` regras puras testadas · `src/app` telas e ações · `src/lib` serviços (PDF, DOCX, IA, cobrança) · `e2e` testes de ponta a ponta · `drizzle` migrações.
Pendências que dependem de você: **PENDING.md**.
