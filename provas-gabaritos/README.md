# Provas e Gabaritos

Catálogo web (celular, tablet e computador) para **localizar e baixar, individualmente, provas e gabaritos oficiais** de 20 instituições brasileiras:
ENEM, Fuvest, COMVEST/Unicamp, VUNESP/Unesp, Univesp, Fatec, UERJ, UFPR, UFRGS, PAS/UnB, ITA, IME, EsPCEx, AFA, FGV, Insper, PUC-SP, Mackenzie, Albert Einstein e ESPM.

> **Estado real da cobertura:** o catálogo é gerado só a partir de páginas oficiais, e **nem todas as instituições têm documentos**. Veja a página `/cobertura` do site, `data/relatorio-coleta.md` (gerado) e `PENDING.md`. Nenhuma instituição é apresentada como “completa”.

## Como o site funciona
- **Download individual, sem hospedar nada.** Cada arquivo tem um botão próprio. Ele passa por `/baixar/<id-da-edição>/<n>`, que responde com um redirecionamento (302) ao arquivo **no site da própria instituição**. Não há ZIP obrigatório e não há cópias dos documentos. Quando um link é conferido como quebrado, o botão passa a levar à página oficial e avisa “link fora do ar”.
- **Páginas:** `/` (instituições, busca em destaque, totais) · `/instituicao/<slug>` (todas as edições agrupadas por ano; filtros por texto, documento, fase/etapa, dia, disciplina e ordem) · `/buscar` (busca global combinável) · `/cobertura` (o que existe em cada instituição, anos com arquivos, anos sem arquivos, lacunas) · `/sobre` · `sitemap.xml` · `robots.txt` · 404 personalizada.
- **Busca:** ignora caixa e acento e reconhece siglas e nomes alternativos (`aliases` em `data/instituicoes.json`): “Unicamp” → COMVEST, “Unesp” → VUNESP, “PAS”/“UnB” → PAS/UnB, “Universidade Presbiteriana Mackenzie” → Mackenzie, “USP” → Fuvest etc.

## Rodar
```bash
pnpm install
pnpm dev            # http://localhost:3000
pnpm test           # vitest: validação, busca, filtros, downloads, cobertura, integridade do catálogo real
pnpm lint
pnpm exec tsc --noEmit
pnpm build          # valida o catálogo (pnpm validar) e compila
```
Dentro de um workspace maior, use `pnpm install --ignore-workspace` nesta pasta.

## Dados (catálogo estático em JSON)
- `data/instituicoes.json` — as 20 instituições: `slug`, `nome`, `sigla`, `categoria`, `descricao`, `site`, `paginaProvas`, `primeiraEdicao`, `observacao`, `aliases`.
- `data/edicoes/<slug>.json` — lista de **edições**. Cada edição tem `id`, `instituicao`, `ano`, `nome`, `fase`, `dia`, `aplicacao`, `fonte` (página oficial) e `arquivos[]` (`tipo` = prova | gabarito | caderno | comentada | edital | outro, `rotulo`, `url`, `formato`, `versao`, `origem`). A disciplina fica no `rotulo` do arquivo. **Os arquivos de uma mesma edição ficam juntos**: PDFs diferentes (versões, disciplinas) não viram edições artificiais.
- `data/verificacao.json` — resultado da conferência de links (`ok` | `quebrado` | `desconhecido`, HTTP, tipo do conteúdo, data).
- `data/coleta/<slug>.csv` — saída dos coletores (colunas em `data/modelo-importacao.csv`); `data/coleta/<slug>-pendencias.txt` — o que foi excluído, o que ficou de fora e por quê; `data/coleta/bloqueios.md` — instituições inacessíveis, tentativas e erros reais.
- `data/relatorio-coleta.md` — relatório de cobertura gerado (`pnpm relatorio --salvar`).
- `src/lib/dados.ts` é **gerado** (`pnpm exec tsx scripts/gerar-dados.ts`) a partir dos JSON; o `validar` roda no build.

## Coletar, importar e validar
Os coletores usam só a biblioteca padrão do Python 3, leem **apenas páginas oficiais**, 1 requisição por segundo, com User-Agent identificado, e **não contornam** bloqueios anti-bot, login ou CAPTCHA.
```bash
python3 scripts/coleta/uerj.py                      # gera data/coleta/uerj.csv e uerj-pendencias.txt
pnpm importar data/coleta/uerj.csv                  # mescla em data/edicoes/uerj.json sem duplicar (o JSON da instituição precisa existir; NÃO apague os vazios)
pnpm exec tsx scripts/gerar-dados.ts                # atualiza src/lib/dados.ts
pnpm validar --avisos                               # erros (quebram o build) e avisos (URL repetida, edição sem gabarito…)
NODE_USE_ENV_PROXY=1 pnpm links --instituicao uerj  # confere os links (use --novos para só os ainda não conferidos); NODE_USE_ENV_PROXY=1 só é preciso atrás de proxy
pnpm relatorio --salvar                             # atualiza data/relatorio-coleta.md
bash scripts/coletar-tudo.sh [coletores…]           # rotina periódica: coleta → importa → valida → confere links → relatório
```
Coletores existentes: `enem`, `fuvest`, `comvest`, `vunesp` (portal da Unesp), `uerj`, `ufpr`, `pas_unb` (API do Cebraspe), `ita`, `pucsp` (NucVest), `mackenzie`, `espm`. Para Univesp, Fatec, UFRGS, IME, EsPCEx, AFA, Insper, FGV e Einstein **não há coletor funcional** (acesso bloqueado ou nada publicado): veja `data/coleta/bloqueios.md`.

### Verificação de links (rigorosa)
`pnpm links` faz HEAD (e GET parcial quando necessário), segue redirecionamentos, e só marca **ok** se a resposta for 2xx/3xx **e** o `content-type` for de arquivo (PDF/ZIP/Office/binário). **HTML com status 200 conta como quebrado** (costuma ser página de erro). Erro de certificado (ex.: servidor do Inep) vira **desconhecido**, não quebrado. Isso confere o endereço e o tipo; a conferência do **conteúdo** (ano, fase, tipo) foi feita por amostragem manual lendo os PDFs (os escaneados não têm texto extraível — ver `PENDING.md`).

### Adicionar uma nova edição à mão
Crie um CSV no formato de `data/modelo-importacao.csv` (`instituicao;ano;nome;tipo;rotulo;url;formato;fonte;fase;dia;aplicacao;versao;origem;observacao`; várias linhas com a mesma instituição, ano e nome viram uma edição com vários arquivos), com a URL copiada da **página oficial**, e rode `pnpm importar`, `pnpm validar --avisos` e `pnpm links --novos`.

## Publicação (Vercel) — preparada, **não publicada**
1. Projeto Next.js 15 padrão (sem banco de dados). Raiz do projeto na Vercel: a pasta `provas-gabaritos`; comando de build: `pnpm build`; instalação: `pnpm install --ignore-workspace`.
2. Variáveis: `NEXT_PUBLIC_SITE_URL` (endereço público, usado no sitemap/canonical/metadados) e, opcionalmente, `NEXT_PUBLIC_CONTATO` (e-mail em “Sobre”).
3. `sitemap.xml` e `robots.txt` são gerados; páginas por instituição são estáticas (SSG); `/baixar/…` e `/buscar` são dinâmicas.
4. **Não foi feito deploy, nem configuração de domínio/DNS.** Decisões pendentes (direitos autorais, domínio, nome) em `PENDING.md`.
