# Provas e Gabaritos

Site (celular e computador) para **baixar provas e gabaritos oficiais, uma instituição por vez**, de 20 instituições:
ENEM, Fuvest, Comvest, Vunesp, Univesp, Fatec, UERJ, UFPR, UFRGS, PAS/UnB, ITA, IME, EsPCEx, AFA, FGV, Insper, PUC-SP, Mackenzie, Albert Einstein e ESPM.

**Como o download funciona:** o site é um *catálogo* de links oficiais. O botão "Baixar" passa por `/baixar/<edição>/<n>`, que redireciona ao arquivo **no site da própria instituição**. Nada é copiado nem hospedado aqui (ver `PENDING.md`, item 1). Quando um link cai, o botão passa a levar à página oficial e mostra "link fora do ar".

**Estado atual: a plataforma está pronta, mas o catálogo de edições está vazio.** Nenhum endereço foi inventado. Cada instituição aparece com "Em breve" até receber suas edições (como preencher: abaixo).

## Rodar
```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # 9 testes (validação, busca, download, importação)
pnpm build        # valida o catálogo antes de compilar
```

## Páginas
`/` instituições por categoria e busca · `/instituicao/<slug>` todas as edições, filtros por texto e tipo, "ir para o ano" · `/buscar` busca por palavras, instituição, período e tipo · `/sobre` como funciona e direitos autorais · `/baixar/<id>/<n>` redirecionamento ao arquivo oficial · `sitemap.xml`, `robots.txt`.

## Dados
- `data/instituicoes.json`: as 20 instituições (endereços oficiais marcados `null` quando ainda não confirmados: Fatec, ITA, AFA).
- `data/edicoes/<instituicao>.json`: uma lista de edições; cada edição tem `id`, `ano`, `nome`, `fonte` (página oficial) e `arquivos` (prova, gabarito, caderno, comentada…, cada um com `url`).
- `data/verificacao.json`: resultado da conferência de links (gerado por `pnpm links`).

### Preencher o catálogo
1. Reúna os links **na página oficial** de cada instituição (nunca de memória) em um CSV no formato de `data/modelo-importacao.csv` (`instituicao;ano;nome;tipo;rotulo;url;formato;fonte;observacao`; várias linhas com o mesmo ano e nome viram uma edição com vários arquivos).
2. `pnpm importar seu-arquivo.csv` (mescla sem duplicar) e `pnpm validar --avisos` (acusa URL repetida, edição sem gabarito, ano anterior à primeira edição…).
3. `pnpm links` confere se cada URL responde e é PDF/ZIP (rode no seu computador; o ambiente de desenvolvimento não alcança os sites oficiais). `pnpm links --instituicao enem` ou `--novos` para só uma parte.
4. `pnpm build` (o catálogo inválido não compila) e publique.

## Configuração (opcional)
`NEXT_PUBLIC_SITE_URL` (endereço público, para sitemap e metadados) · `NEXT_PUBLIC_CONTATO` (e-mail exibido em "Sobre" para remoções e links quebrados).
