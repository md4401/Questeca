# Segunda Lousa — versão professores

> **Ramificação `versao-professores`: 100% para professores e coordenação.** Não há portal de aluno ou responsável, convites de acesso, gamificação, quizzes, tarefas com entrega, mural de turma, videoaulas nem mensagens com alunos. A versão com tudo isso é a ramificação **`versao-completa`** (igual à `main`). As duas usam as mesmas migrações do banco, então o mesmo banco serve às duas.


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
pnpm test        # 88 testes de regras (filtro, notas, cotas, permissões, gabarito, análise, chat, quiz, gamificação, frequência, agenda)
pnpm build && pnpm start -p 3100   # com .env.test.local apontando para um branch de teste do banco
pnpm e2e         # cenários AV-01..08 e SA-01..10 do PRD + P2, em navegador real; axe WCAG 2.2 AA
```
## Módulos
**Professor e escola** (`/app`): provas com questões reais, correção, notas, relatórios, documentos, comunidade docente, planos e cobrança.
**Rotina docente** (por turma, em `/app/turmas/[id]`): chamada com correção auditada, boletins em PDF (emitidos e guardados para imprimir), painel pedagógico com sinais explicados e limites da escola, observações. Também: agenda (`/app/agenda`), grade de horários com detecção de conflito, mensagens entre colegas, materiais compartilhados com aprovação da coordenação, moderação, gestão acadêmica (`/app/gestao`: cadastros, transferências com histórico, ano letivo), foto de perfil e tema escuro.
**MVP do professor** (novidades): **cartão com QR** (`/app/escanear`, `/app/g/[token]`: escaneou, conferiu, a nota vai para a turma e a coordenação é avisada); **planos de aula** (`/app/planos-de-aula`: tema → documento escolar, edita, baixa em Word, envia à coordenação); **pareceres descritivos** (por turma, em `/pareceres`: registros rápidos do mês viram rascunho por aluno, você aprova); **Aula de Agora** no Início (grade de horários em todas as suas escolas → turma, plano e chamada de um toque); **Radar de alunos** (`/app/radar`: queda brusca de nota, faltas seguidas, frequência baixa; avisa a coordenação). Sem chave de IA tudo funciona por modelos; com `AI_PROVIDER=anthropic` planos e pareceres são redigidos pela IA.
Decisões: mensagens atualizam por consulta a cada 4 s (sem WebSocket); lembretes de agenda surgem ao abrir o sistema (sem agendador).

## Estrutura
`src/lib/core` regras puras testadas · `src/app` telas e ações · `src/lib` serviços (PDF, DOCX, IA, cobrança) · `e2e` testes de ponta a ponta · `drizzle` migrações.
Pendências que dependem de você: **PENDING.md**.
