# Questeca — Plano técnico e roadmap (P0 + P1 + P2)

## Contexto
O PRD v1.0 (38 p.) descreve a Questeca: SaaS web pt-BR para professores (6º–9º e EM) e escolas. Fluxo: conteúdo ensinado → prova com **questões reais** filtradas por pré-requisito → PDF/gabarito no modelo da escola → correção → notas → retomada → documentos da coordenação + comunidade. O repositório `md4401/Questeca` está vazio (só README). Este plano cobre a arquitetura e a ordem de construção das três fases, tudo em um único monorepo, com os critérios AV-01..08 e SA-01..10 do PRD como portões de cada fase.

Decisões tomadas: **Next.js + Postgres**. Provedor de IA **ainda não definido** → camada de IA agnóstica (Vercel AI SDK) com adaptadores; troca por variável de ambiente.

---

## 1. Stack
| Camada | Escolha |
|---|---|
| App | Next.js 15 (App Router, TypeScript strict, Server Actions + Route Handlers), pnpm |
| UI | Tailwind + shadcn/ui (Radix, acessível), tokens da marca (`#F7F5EE`, `#FFFFFF`, `#1B302C`, `#135B4E`, âmbar p/ conferência), DM Sans (controles) + Spectral (enunciados), KaTeX p/ fórmulas |
| Banco | Postgres 16 + **Drizzle ORM** + migrações; `pgvector` (busca semântica) + `pg_trgm`/FTS português (busca textual) |
| Auth | Better Auth (e-mail+senha, verificação, reset, sessões, organizações/convites) |
| Arquivos | Storage S3-compatível (R2/S3/MinIO local) com URLs assinadas de validade curta |
| Jobs | Fila em Postgres (**pg-boss**) + worker Node separado (`apps/worker`) para PDF, OCR, importação, IA |
| PDF/Word | HTML→PDF com Playwright/Chromium no worker (A4, escala de cinza); `docx` (npm) para Word |
| IA | `packages/ai`: interface `AIProvider` (generateObject, vision, embed) via Vercel AI SDK; adaptadores Anthropic/OpenAI/Google; prompts versionados; saída sempre validada por Zod |
| OMR (cartões) | Cartão com marcadores fiduciais + QR (avaliação/versão/aluno); leitura com OpenCV (opencv-wasm ou microserviço Python opcional) no worker; baixa confiança → fila de conferência |
| Pagamentos | Interface `BillingProvider` (Stripe ou Pagar.me/Asaas p/ Pix/boleto) + webhooks idempotentes |
| E-mail | Resend (transacional) |
| Testes | Vitest (unit/regras), Playwright (E2E = cenários AV/SA), axe-core (WCAG 2.2 AA) |
| Observabilidade | Sentry + logs estruturados (pino) sem PII; tabela `audit_log` |
| Infra | Docker Compose local (Postgres, MinIO, Mailpit); deploy app (Vercel ou Fly/Render) + worker em container |

## 2. Estrutura do monorepo
```
apps/web        Next.js (site público, app, admin interno)
apps/worker     consumidores pg-boss (pdf, docx, ocr, omr, import, ai, email)
packages/db     schema Drizzle, migrações, seeds (dados fictícios + acervo demo)
packages/core   regras de domínio puras (elegibilidade, cálculo de notas, cotas, permissões)
packages/ai     AIProvider + prompts + schemas Zod
packages/ui     design system Questeca
packages/docs   templates de prova/relatório (HTML) e gerador DOCX
tooling/        eslint, tsconfig, scripts de importação de acervo
```
Regras de negócio críticas (filtro, notas, cotas, permissões) ficam em `packages/core`, puras e 100% testadas — a UI e a IA só as chamam.

## 3. Modelo de dados (núcleo)
- **Identidade/tenancy:** `user`, `session`, `organization` (escola ou espaço pessoal, `kind`), `membership` (user×org, papel: professor/coordenação/gestor/… + estado), `invitation` (pendente/aceito/expirado/revogado), `class_assignment` (professor×turma×disciplina).
- **Escola:** `school_settings` (calendário, períodos, escala, pesos, arredondamento, recuperação), `doc_template` (cabeçalho/prova/relatório, versão, aprovado_por).
- **Acervo:** `source` (instituição, licença/autorização, escopo), `edition` (prova, ano, fase, dia, caderno), `question` (identidade canônica), `question_revision` (enunciado em JSON estruturado, alternativas, figuras, gabarito, recursos, status: curadoria/só_referência/liberado/em_revisão/bloqueado, revisor, data), `question_occurrence` (edição×caderno×número×página), `shared_stimulus` (texto-base compartilhado), `skill`/`topic` (taxonomia própria + BNCC só quando verificada), `question_requirement` (revisão×tópico, papel: avaliado/pré-requisito, métodos válidos), `question_embedding`.
- **Turma:** `class` (org, ano letivo, série, disciplina, nome), `student` (id estável, nome, identificador escolar), `enrollment` (aluno×turma×período), `taught_scope` (tópicos: vai_cair/pré-requisito/não_ensinado/confirmar, origem: texto/arquivo/diário).
- **Avaliação:** `assessment` (rascunho, turma, escopo snapshot), `assessment_item` (revisão fixada, ordem, pontos, fixado, adaptada_privada), `assessment_version` (imutável: itens, gabarito, pesos, cabeçalho, escopo), `application` (versão×turma×data; segunda chamada liga à original), `export_file`.
- **Correção/notas:** `answer_sheet` (imagem, status, confiança), `response` (aluno×aplicação×item, valor, pendente/em_branco/ausente), `rubric`/`rubric_score`, `grade_item` (atividade, peso, categoria, externa?), `grade` (valor, estado: zero/ausente/não_entregue/pendente, origem), `grade_change` (histórico), `period_close`.
- **Pedagógico:** `observation`, `lesson_log` (diário), `plan`, `report` (evidências, versão, status de revisão), `review_request` (coordenação).
- **Comunidade:** `post` (público: geral/escola), `comment`, `attachment`, `saved_item`, `report_flag`, `moderation_action`.
- **SaaS:** `plan`, `subscription`, `usage_counter` (montagens, cartões por ciclo, idempotente por chave), `invoice`, `notification`, `support_ticket`, `audit_log`.

**Isolamento:** todo registro de escola carrega `organization_id`; acesso passa por `packages/core/permissions` (checagem por recurso+ação) **e** Postgres RLS com `app.org_id`/`app.user_id` por transação (defesa em profundidade).

## 4. Motor de seleção (coração do produto)
Pipeline determinístico em `packages/core/selection` com IA só onde necessário:
1. **Integridade (SQL):** revisão `liberado`, licença permite reprodução, gabarito verificado, não anulada.
2. **Conhecimento (pré-computado no acervo):** cada revisão tem `question_requirement` classificado na curadoria (IA propõe → humano valida). Em runtime não se chama IA para isso.
3. **Exclusões:** item sai se algum requisito obrigatório ∉ (vai_cair ∪ pré-requisito) ou ∈ não_ensinado; se houver método alternativo válido dentro do escopo, mantém e registra; tópico "confirmar" → item vai a revisão.
4. **Ordenação:** score = cobertura de lacunas + fonte preferida + dificuldade + tempo + novidade para a turma; agrupa itens com estímulo comum.
5. **Explicação:** template + dados estruturados (assunto, pré-requisitos, motivo, link de origem); IA só para redação opcional.
6. **Cobertura insuficiente:** retorna "6 de 8" + temas descobertos + ações (Usar as 6 / Ampliar fontes / Ajustar conteúdos).

Entrada do professor (texto/PDF/DOCX/foto) → job de IA extrai tópicos para a taxonomia com trechos de origem → professor confirma nas 4 listas antes de buscar. Testes AV-01/02 rodam contra um acervo-semente com a questão 163 Enem 2013 (cad. azul, gabarito E).

## 5. Roadmap de construção
Cada etapa termina com seus testes E2E verdes. As fases são sequenciais no código, mas tudo fica no plano e no mesmo repositório.

### Fase 0 — Fundação (pré-P0)
Monorepo, CI (lint, typecheck, vitest, playwright), Docker Compose, Drizzle + migrações, design system e tokens, i18n/formatos pt-BR (vírgula, R$, datas), Sentry, pg-boss + worker, storage, seeds fictícios identificados, `AIProvider` com adaptador fake para testes.

### P0 — Piloto (Matemática 8º/9º)
1. **Conta e acesso:** cadastro, verificação de e-mail, login, reset com rate-limit, sessões, convite com papel/turma, troca de escola, área pessoal (SA-01, SA-02).
2. **Onboarding:** escola → disciplina/série/turma → "Criar primeira prova"; turma de exemplo identificada (SA-03).
3. **Acervo + admin interno:** importador por edição (PDF oficial → extração assistida → revisão humana), dedupe entre cadernos, estados de curadoria, ficha mínima, painel de cobertura; carga inicial Enem + Etec Matemática (AV-03, AV-08).
4. **Escopo e seleção:** formulário 4 listas, upload de material, motor de seleção, banco manual com busca texto+semântica (AV-01, AV-02).
5. **Editor:** folha + mapa, trocar (até 3 alternativas), fixar, reordenar (botões + arrastar), remover, desfazer, autosave com estado, histórico, versão de aplicação imutável, conflito de escopo (AV-04).
6. **Modelo da escola + exportação:** cabeçalho/logo, prévia A4 e cinza com alertas, PDF do aluno e PDF do professor separados (AV-05).
7. **Turmas/alunos:** criar turma, lista manual/colar/planilha com detecção de homônimos e duplicatas (SA-04).
8. **Notas P0:** grade por teclado, importação CSV/Excel com prévia, respostas por item em lote, estados distintos (zero/ausente/pendente), média ponderada com fórmula visível e recuperação, fechamento + exportação CSV/PDF (SA-05).
9. **Resultados e retomada:** análise por item/habilidade quando houver respostas, só agregados quando não houver (SA-06); lista de retomada e checagem com questões reais.
10. **Segurança/privacidade:** RLS, links assinados, audit_log, termos/LGPD, acessibilidade básica (SA-10).
11. **Métricas do piloto:** eventos (tempo pedido→PDF, ativação em 7 dias, trocas e motivos, itens excluídos indevidos).

### P1 — Lançamento comercial
1. **Word editável** (DOCX) com marcação de versão.
2. **Segunda chamada** com comparação de cobertura/dificuldade/tempo e itens distintos (AV-06); avaliação externa registrada.
3. **Cartão-resposta + correção por foto:** geração de cartões (QR + fiduciais), captura mobile/lote/scanner, vínculo aluno/versão, OMR, fila de conferência com recorte, sem duplicar nota (AV-07); discursivas com rubrica.
4. **Foto/PDF de tabela de notas** com OCR + células incertas + confirmação.
5. **Documentos da coordenação:** diário, planejamento, andamento, relatório individual, conselho de classe, devolutiva às famílias — rascunho por IA a partir de dados confirmados, trechos sem evidência em aberto, fluxo de revisão institucional (SA-07).
6. **Comunidade:** mural geral e da escola, tópicos/comentários/anexos, salvos, busca, denúncias, fila de moderação, bloqueio de dados de alunos (SA-08).
7. **Administração escolar:** padrões, convites em massa, licenças, acompanhamento de entregas e uso, saída/renovação com exportação.
8. **SaaS completo:** planos Gratuito/Professor/Escola, cotas (montagem contada no 1º salvamento válido; cartão distinto 1×), checkout, webhooks, falha/atraso, troca/cancelamento/reativação, contrato escolar, central de ajuda, suporte, notificações com preferências (SA-09).
9. **Operação interna:** ocorrências em questões com impacto em avaliações/notas, retificação de gabarito com reprocessamento após aprovação, painel de saúde, reconciliação de cobrança.
10. **Confiabilidade:** metas do PRD (início < 2,5 s p95, salvamento < 2 s, PDF 12 p < 20 s, lote 40 cartões/300 linhas), edição simultânea com detecção de versão, WCAG 2.2 AA completo.

### P2 — Expansão
1. **Cobertura:** demais séries do EF II e EM, outras disciplinas; Fuvest/Comvest e acervos licenciados; ferramentas de curadoria em escala.
2. **Versões A/B por turma** preservando gabaritos e estímulos.
3. **Aplicação digital** (link para aluno, sem conta pessoal obrigatória, correção automática).
4. **Integrações** com sistemas escolares (import/export padronizado, depois APIs/SSO).
5. **Permissões finas** (por disciplina/unidade, supervisores, multi-unidade).
6. **Comunicação com responsáveis** pelos canais oficiais; mensagens diretas/chat na comunidade se validados.
7. **Observação por voz** (transcrição) e sugestões de agrupamento por aprendizagem.

## 6. Pré-requisitos externos (não são código)
- **Direitos do acervo:** confirmar permissão de reprodução (Inep/Enem, Centro Paula Souza, Fuvest, Comvest) antes de marcar itens como `liberado`; sem isso, `só_referência`.
- **Curadoria humana** para classificar requisitos das primeiras ~300–500 questões de Matemática.
- **Escola piloto:** modelo de cabeçalho, planilha de notas e regras de média reais.
- **Escolhas pendentes:** provedor de IA (avaliar com o mesmo conjunto de teste de classificação), gateway de pagamento, hospedagem.

## 7. Primeiros arquivos a criar
`package.json`/`pnpm-workspace.yaml`, `docker-compose.yml`, `packages/db/schema/*.ts`, `packages/core/selection/eligibility.ts` (+ testes), `packages/core/grades/compute.ts` (+ teste 7,5×0,6 + 9,0×0,4 = 8,10), `packages/core/permissions/index.ts`, `packages/ai/provider.ts`, `apps/web/app/(app)/provas/[id]/editor/page.tsx`, `apps/worker/jobs/export-pdf.ts`, `e2e/av/*.spec.ts`, `e2e/sa/*.spec.ts`.

## 8. Verificação
- `pnpm test` — regras puras (elegibilidade, notas, cotas, permissões) com casos do PRD.
- `pnpm e2e` — um spec por critério AV-01..08 e SA-01..10, rodando sobre seeds fictícios e a questão de referência do Enem 2013.
- `pnpm e2e:a11y` — axe em editor, notas e onboarding; teste manual de teclado/zoom/celular.
- Testes de isolamento: usuário do Colégio A não acessa Colégio B nem por URL direta (SA-02, SA-08).
- Teste de carga do worker: PDF de 12 páginas, lote de 40 cartões, planilha de 300 linhas.
- Portão de fase: P0 só fecha com AV + SA aplicáveis verdes e um professor fazendo prova→PDF→notas sem ajuda; P1 idem com cobrança e comunidade.
