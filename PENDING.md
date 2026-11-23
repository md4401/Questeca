# PENDING — o que só você consegue fazer

Tudo abaixo foi deixado de fora porque exige conta, chave, decisão ou conteúdo que eu não tenho.
Itens marcados **[bloqueia o lançamento]** devem ser resolvidos antes de abrir para usuários reais.

## 0. Deploy — **feito**
Publicado no Stay Cloud: https://questeca.stayai.space/ (variáveis criadas no painel). Para republicar: `npx @staysdev/setup deploy`.
Alternativa Vercel: o conector recusou (403); se quiser, importe `md4401/Questeca` em vercel.com e repita as variáveis do `.env.example`.
Banco: schema e acervo-semente já aplicados no Neon. **Gire a senha do role `neondb_owner`** (passou pela conversa) e atualize `DATABASE_URL` no painel.

## 2. E-mail transacional e domínio próprio  **[bloqueia o lançamento]**
Sem e-mail **não funcionam** verificação de conta, recuperação de senha nem convites por e-mail (o convite mostra o link para copiar).
**Falta um domínio próprio.** Estado atual: no Resend já existe o domínio `questeca.stayai.space` (região sa-east-1, status *não verificado*),
criado por engano: `stayai.space` é da Stay Cloud e você não controla o DNS, então ele nunca vai verificar. Pode ser removido do Resend.
Passos quando houver domínio:
1. Registre um domínio (ex.: `questeca.com.br` no Registro.br, ~R$ 40/ano).
2. Peça-me para criá-lo no Resend (sa-east-1); cadastre no DNS os registros DKIM (TXT), SPF (MX e TXT) e CNAME que ele mostrar; peça a verificação.
3. Crie uma chave de API "sending access" restrita ao domínio e, no painel do Stay Cloud, as variáveis `RESEND_API_KEY` e `EMAIL_FROM` (`Questeca <nao-responda@SEU_DOMINIO>`); opcional `REQUIRE_EMAIL_VERIFICATION=true`.
4. Opcional: apontar o site para o domínio (ex.: `app.SEU_DOMINIO`) e atualizar `APP_URL` e `NEXT_PUBLIC_APP_URL`.
Enquanto isso: quem esquecer a senha precisa de redefinição manual (via `/admin` ou banco).

## 3. Acervo real de questões e direitos de uso  **[bloqueia o lançamento]**
- O acervo atual tem **46 itens autorais de exemplo** (gabarito conferido) + a Q163/Enem 2013 **só como referência** (sem enunciado).
  Não reproduzi questões do Enem/vestibulares de memória: poderiam sair erradas ou sem autorização.
- Importar Inep/Enem, Etec, Fuvest, Comvest exige: obter os PDFs oficiais, **confirmar a permissão de reprodução** de cada titular
  (Lei 9.610/1998; ver FAQ da Comvest) e passar pela curadoria. A área `/admin → Acervo e curadoria` já tem importação em lote
  (JSON), estados de liberação, dedupe por caderno/número e retificação de gabarito. Itens só viram "Liberado" com enunciado, gabarito e licença registrados.
- Falta curadoria humana da classificação (conteúdos avaliados × pré-requisitos) das primeiras 300–500 questões de Matemática.
- Atualize o registro de quem é a equipe: defina `STAFF_EMAILS` e crie as contas (acesso a `/admin`).

## 4. Textos jurídicos  **[bloqueia o lançamento]**
`/termos` e `/privacidade` agora são textos completos (LGPD, CDC, Marco Civil), **mas escritos por IA, não por advogado**.
Faça: (1) crie no painel as variáveis `LEGAL_NAME`, `LEGAL_CNPJ`, `LEGAL_ADDRESS`, `LEGAL_EMAIL`, `LEGAL_DPO`, `LEGAL_FORUM` (as páginas mostram "[defina ...]" até lá);
(2) peça a um advogado que revise (prazos de retenção, foro, base legal para dados de estudantes); (3) assine contratos/DPAs com Neon, Stay Cloud, Resend, Stripe.

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
