# PENDING — o que só você pode decidir ou fazer

## 1. Direitos autorais (decisão sua, antes de abrir ao público)  **[bloqueia o lançamento]**
Provas e gabaritos são das instituições. A versão atual **só aponta** para os arquivos oficiais (não copia nem hospeda), o que é o caminho mais seguro. **Hospedar cópias** (ZIP por instituição, backup dos PDFs) exigiria autorização de cada titular; não implementei. Revise o texto de `/sobre` com um advogado e defina o e-mail de contato (`NEXT_PUBLIC_CONTATO`).

## 2. Preencher o catálogo  **[bloqueia o lançamento]**
O catálogo está vazio de propósito: do ambiente de desenvolvimento não alcancei os sites oficiais (o servidor do Inep, por exemplo, está fora da rede liberada e envia o certificado incompleto), e **não invento endereços de provas**. "Desde a primeira edição" de 20 instituições são milhares de arquivos. Caminhos:
- **Você ou uma pessoa de apoio** monta os CSVs a partir das páginas oficiais (instruções no README) e roda `pnpm importar`.
- **Comigo**, instituição por instituição: libere a rede para o domínio oficial (ou me envie o HTML/lista salvos da página) e eu monto o CSV, importo e valido. Recomendo começar por ENEM e Fuvest.
Depois de importar, rode `pnpm links` (no seu computador) para marcar links quebrados e repita de tempos em tempos (por exemplo, a cada mês), porque as bancas movem arquivos.

## 3. Confirmar dados das instituições
Os endereços oficiais em `data/instituicoes.json` vieram de conhecimento geral, **não foram verificados online**; confirme todos. Fatec, ITA e AFA estão sem endereço (`null`). Confirme também a "primeira edição" de cada banca (só o ENEM, 1998, está preenchido) e a lista/descrições.

## 4. Publicação e nome
Escolha domínio e hospedagem (o site é estático em quase tudo; roda no Stay Cloud ou na Vercel). Defina `NEXT_PUBLIC_SITE_URL`. "Provas e Gabaritos" é um nome de trabalho: confira disponibilidade e marca antes de divulgar.

## 5. Possíveis próximos passos (não pedidos)
Download em lote por instituição (só com a autorização do item 1), aviso por e-mail de novas edições, contador de downloads e relatório de links quebrados, edição do catálogo por painel em vez de arquivos.
