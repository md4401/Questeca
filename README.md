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
pnpm test        # 46 testes de regras (filtro, notas, cotas, permissões, gabarito, análise)
pnpm build && pnpm start -p 3100   # com .env.test.local apontando para um branch de teste do banco
pnpm e2e         # cenários AV-01..08 e SA-01..10 do PRD + P2, em navegador real; axe WCAG 2.2 AA
```
## Estrutura
`src/lib/core` regras puras testadas · `src/app` telas e ações · `src/lib` serviços (PDF, DOCX, IA, cobrança) · `e2e` testes de ponta a ponta · `drizzle` migrações.
Pendências que dependem de você: **PENDING.md**.
