# PENDING — o que só você consegue fazer

Tudo abaixo foi deixado de fora porque exige conta, chave, decisão ou conteúdo que eu não tenho.
Itens marcados **[bloqueia o lançamento]** devem ser resolvidos antes de abrir para usuários reais.

## 0. Deploy no Stay Cloud (feito até onde a CLI permite)  **[bloqueia o lançamento]**
O projeto **Questeca** foi criado no Stay Cloud (`deploy --new`, subdomínio `questeca`) e os 158 arquivos foram enviados, mas o
deploy parou em `missing_env`: a plataforma pede variáveis que só podem ser criadas no painel (**Cloud > Variáveis**; a CLI não cria variáveis).
Crie lá, depois rode `npx @staysdev/setup deploy` (ou republique pelo painel):
- `DATABASE_URL` (string pooled do Neon, ver item 1), `AUTH_SECRET` (`openssl rand -hex 32`)
- `NEXT_PUBLIC_APP_URL` e `APP_URL` = URL pública do projeto no Stay Cloud
- `REQUIRE_EMAIL_VERIFICATION=false`, `AI_PROVIDER=none`, `BILLING_PROVIDER=none` (até configurar e-mail/IA/cobrança)
Não verifiquei se o Stay Cloud executa Next.js com funções de servidor (o app precisa); confira em `npx @staysdev/setup status` / `logs`.
Não consegui validar o app publicado (status atual: `draft`). A credencial local fica em `.staycloud/` (ignorada pelo git).

## 1. Deploy na Vercel (alternativa)  **[bloqueia o lançamento, se for usar Vercel]**
O conector da Vercel recusou criar o projeto (`403 forbidden` ao criar em `mdinizmarques1-6271s-projects`).
1. Em vercel.com → *Add New Project* → importe `md4401/Questeca` (instale o app GitHub da Vercel no repositório, se pedir).
2. Branch de produção: faça merge de `claude/confident-dirac-3qebne` em `main` (ou defina essa branch como produção).
3. Framework: Next.js (auto). Região das funções: **gru1 (São Paulo)**, perto do Neon (`aws-sa-east-1`).
4. Variáveis (Production + Preview): `DATABASE_URL`, `AUTH_SECRET` — ver `.env.example`.
   - `DATABASE_URL`: string *pooled* do projeto Neon **questeca** (id `fragrant-unit-00970553`, branch principal). Está em `.env.local` desta sessão; **gire a senha do role `neondb_owner` no console do Neon** depois de copiar, pois ela passou por esta conversa.
   - `AUTH_SECRET`: `openssl rand -hex 32`.
5. Não defina `NEON_FETCH_VIA_HOST`, `ALLOW_MOCK_BILLING`, `RATE_LIMIT_MULTIPLIER`, `DEV_EMAIL_OUTBOX`.
6. Após o primeiro deploy, abra `/` e `/planos`, crie uma conta e rode um fluxo (criar prova → PDF).
7. Domínio próprio e `APP_URL`.

Banco: o schema e o acervo-semente **já estão aplicados no branch principal** do Neon. Para novos ambientes: `pnpm db:migrate && pnpm db:seed`.
O branch `test` do Neon é só para os testes E2E (pode ser apagado).

## 2. E-mail transacional  **[bloqueia o lançamento]**
Sem `RESEND_API_KEY` + domínio verificado: não chegam e-mails de verificação, recuperação de senha nem convites
(o convite mostra o link para copiar; a recuperação de senha **não funciona**). Crie conta no Resend, verifique o domínio,
defina `RESEND_API_KEY` e `EMAIL_FROM`; depois, se quiser, `REQUIRE_EMAIL_VERIFICATION=true`.

## 3. Acervo real de questões e direitos de uso  **[bloqueia o lançamento]**
- O acervo atual tem **46 itens autorais de exemplo** (gabarito conferido) + a Q163/Enem 2013 **só como referência** (sem enunciado).
  Não reproduzi questões do Enem/vestibulares de memória: poderiam sair erradas ou sem autorização.
- Importar Inep/Enem, Etec, Fuvest, Comvest exige: obter os PDFs oficiais, **confirmar a permissão de reprodução** de cada titular
  (Lei 9.610/1998; ver FAQ da Comvest) e passar pela curadoria. A área `/admin → Acervo e curadoria` já tem importação em lote
  (JSON), estados de liberação, dedupe por caderno/número e retificação de gabarito. Itens só viram "Liberado" com enunciado, gabarito e licença registrados.
- Falta curadoria humana da classificação (conteúdos avaliados × pré-requisitos) das primeiras 300–500 questões de Matemática.
- Atualize o registro de quem é a equipe: defina `STAFF_EMAILS` e crie as contas (acesso a `/admin`).

## 4. Textos jurídicos  **[bloqueia o lançamento]**
`/termos` e `/privacidade` são modelos iniciais (LGPD/ANPD). Precisam de revisão jurídica, indicação do controlador/encarregado (DPO),
canal de titulares, prazos de retenção e contrato de operadores (Neon, Vercel, Resend, Stripe, IA).

## 5. Cobrança (Stripe)
Implementado (checkout, webhook com assinatura verificada e idempotente, falha/carência de 7 dias, cancelar/reativar), **mas não testado contra a Stripe real** (testado com provedor simulado).
1. Crie produto "Professor" R$ 39,90/mês (recorrente) → `STRIPE_PRICE_PROFESSOR`; `STRIPE_SECRET_KEY`; `BILLING_PROVIDER=stripe`.
2. Webhook → `https://SEU_DOMINIO/api/billing/webhook` com eventos `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.
3. Pix/boleto, nota fiscal e CNPJ/emissão: decisão e cadastro seus. Preços e cotas são **hipóteses do PRD** a validar no piloto.
4. Plano **Escola**: contrato manual — `/admin → Assinaturas` aplica limites. Novas escolas entram com teste de 60 dias (limites 60 montagens/30 turmas/500 cartões).
Sem Stripe configurado, o app mostra "Solicitar contratação" (cai em `/admin`).

## 6. IA (opcional, ainda sem provedor definido)
`AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` (+ `AI_MODEL`) habilita: leitura de **foto** de apostila, de **tabela de notas** e de **cartão-resposta**.
Código pronto, **não testado com chave real**. Sem IA: texto/PDF/DOCX e planilhas funcionam; as fotos são conferidas manualmente (imagem ao lado).
A leitura automática de cartões é por IA de visão, **não OMR clássico** — meça erro por cartão no piloto antes de confiar. Defina o provedor definitivo e avalie com o mesmo conjunto de teste.

## 7. Escola piloto e validação
Modelo real de cabeçalho/logo autorizado, planilha de notas e regras de média da escola, 5–10 professores (Matemática 8º/9º). Indicadores já coletados em `/admin → Indicadores do piloto`.
Metas do PRD (≥30% menos tempo; zero item excluído) ainda precisam de linha de base e medição real.

## 8. Itens do PRD não construídos (de propósito) — dependem de validação/terceiros
- **P2**: versões A/B por aluno, integração com sistemas escolares (SSO/APIs), permissões por disciplina/unidade, comunicação direta com responsáveis, chat/mensagens diretas, mais matérias e séries (dependem de acervo e de validação, como o próprio PRD define).
- **Resolução comentada** por questão e **mapeamento BNCC** (só "quando verificável"): sem fonte autorizada, não há dado.
- Drag-and-drop para reordenar (há botões ↑/↓, que o PRD exige como alternativa).
- Fórmulas em LaTeX/KaTeX e figuras nos enunciados: o acervo atual é texto Unicode. Os PDFs trocam símbolos fora da fonte (ex.: π → "pi"). Necessário ao importar questões reais com figuras.
- Isolamento no banco por RLS do Postgres: o isolamento hoje é por checagem de permissão no código em todo acesso (testado: escola A × B, turma, anexos), não por RLS (driver HTTP do Neon). Recomendo RLS como defesa extra.
- Fila/worker assíncrono: PDF/Word são gerados na hora, em JavaScript puro (rápido para provas de até ~12 páginas). Lotes muito grandes podem exigir fila.
- Limite de upload ~4 MB por envio (limite da Vercel). Arquivos maiores precisam de storage externo (Vercel Blob/S3) — imagens e anexos hoje ficam no Postgres.
- Observabilidade: sem Sentry/alertas. Backups: use o *point-in-time restore* do Neon (retenção padrão curta — aumente o plano/retention).

## 9. Segurança — conferir antes de abrir
- Gire a senha do banco (item 1). Revise `STAFF_EMAILS`. Rate-limits e bloqueio por tentativas já ativos.
- Teste de penetração e revisão de LGPD por terceiros antes de escolas reais.
