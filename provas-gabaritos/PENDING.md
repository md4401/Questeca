# PENDING — o que só você pode decidir ou fazer

## 1. Direitos autorais (decisão sua, antes de abrir ao público)  **[bloqueia o lançamento]**
Provas e gabaritos são das instituições. A versão atual **só aponta** para os arquivos oficiais (não copia nem hospeda), o que é o caminho mais seguro. **Hospedar cópias** (ZIP por instituição, backup dos PDFs) exigiria autorização de cada titular; não implementei. Revise o texto de `/sobre` com um advogado e defina o e-mail de contato (`NEXT_PUBLIC_CONTATO`).

## 2. Preencher o catálogo  **[em andamento — 3 completas e 1 parcial (Vunesp) de 20]**
Estado em 2026-11-23 (cada linha vem de páginas oficiais; nada foi inventado):

| Instituição | Situação | Edições | Arquivos | Anos |
|---|---|---|---|---|
| ENEM | coletada (Inep) — ver ressalvas abaixo | 99 | 849 | 1998–2026 |
| Fuvest | coletada (Acervo dos vestibulares) | 139 | 326 | 1977–2026 |
| **COMVEST/Unicamp** | **coletada** (detalhes abaixo) | **114** | **571** | **1987–2027** |
| **Vunesp/Unesp** | **parcial** (2019–2022 apenas; detalhes em 2.4) | **6** | **17** | **2019–2022** |
| Univesp, Fatec, UERJ, UFPR, UFRGS, PAS/UnB, ITA, IME, EsPCEx, AFA, FGV, Insper, PUC-SP, Mackenzie, Einstein, ESPM | **não coletadas** (arquivos JSON existem, vazios) | 0 | 0 | — |

Coletores: `scripts/coleta/<instituicao>.py` → `data/coleta/<instituicao>.csv` → `pnpm importar data/coleta/<instituicao>.csv` → `pnpm validar` → `pnpm links --instituicao <slug>`. (Atenção: o importador exige que `data/edicoes/<slug>.json` exista; não apague os vazios.)
`pnpm links` precisa de `NODE_USE_ENV_PROXY=1` quando se está atrás de proxy (o `fetch` do Node não lê `HTTPS_PROXY` sozinho).

### 2.1 COMVEST/Unicamp — concluída com lacunas que são do próprio acervo oficial
- **Importado:** 114 edições, 571 arquivos (377 provas, 181 gabaritos/respostas esperadas, 9 provas comentadas, 4 erratas), anos **1987–2027** (41 anos, sem salto). Cada edição foi lida na sua própria página oficial (`/vestibulares-anteriores/vestibular-AAAA/`, subpáginas de provas/respostas esperadas e `ingresso-AAAA`). Os 20 conjuntos de **provas de habilidades específicas** (Arquitetura, Artes, Música, Odontologia…) aparecem como edições "· Habilidades Específicas".
- **Verificação:** `pnpm links --instituicao comvest` → 571 ok, 0 quebrados (resposta 2xx **e** `content-type` de arquivo; resposta HTML conta como quebrada). Amostra de 30 PDFs baixados e lidos (1987–2027, prova e gabarito): todos são o documento esperado do ano/fase.
- **Convenção de ano:** o ano é o do nome oficial do vestibular ("Vestibular 2019" = ingresso 2019, aplicado em nov/2018–jan/2019).
- **Gabarito:** a Comvest chama de "respostas esperadas" os gabaritos das provas discursivas e de "gabarito" o da prova objetiva (1ª fase). Aparecem com esses rótulos.
- **Edições SEM gabarito/respostas esperadas no acervo oficial (nada foi fabricado):**
  - **1987–2002**, 1ª e 2ª fases (1988 teve dois vestibulares, ambos sem) e **2003 – 2ª fase**: a Comvest só publica as provas. (2003 – 1ª fase tem a "expectativa da banca de redação".)
  - **2023 – 1ª fase**: a página oficial publica as provas Q/Z/R/Y/S/X/T/W mas não o gabarito objetivo.
  - As edições de habilidades específicas não têm gabarito (a prova é prática/discursiva).
- **2027 está incompleto de propósito:** só a 1ª fase (provas e gabaritos) está publicada; a 2ª fase ainda não saiu. Rode o coletor de novo depois.
- **Classificação inferida (conferir se quiser):** 2016 e 2017 – "Expectativas da Banca de Redação" ficou com fase "Não informada" (a página não diz); "gabaritoAAAA" foi tratado como 1ª fase e "<disciplina>resp" como 2ª fase quando a página não indica a fase; 2021 – 1ª fase teve dois dias (6/1 e 7/1), identificados pelo texto oficial ("Dia 6/1", "Dia 7/1").
- **Links oficiais retirados por estarem indisponíveis** (listados em `data/coleta/comvest-pendencias.txt`): `2020-Musica-Licenciatura.docx`, `2018-Musica-Licenciatura.docx`, `PHE-Musica-2018-Teoria.docx` (HTTP 403 também no navegador); `vest2004/F2/provas/Musica.zip` (404, prova de Música 2004); `vest2002/F2/solucao_enigma.pdf` (404 e não é prova). 2019 – Arquitetura: a página oficial tem o link com erro de protocolo (`p://www…`); foi corrigido para `https://` e o arquivo foi conferido (registrado em `observacao`).
- **Excluídos de propósito** (49 itens em `comvest-pendencias.txt`): editais/resoluções, manuais, programas de prova, listas de aprovados/chamadas, abstenção, notas de corte, relação candidato-vaga, isenção, diretrizes de redação, informes de habilidades específicas (local/horário), notas de esclarecimento.
- **Não importado — limitação:** a página "Provas comentadas" (`/vestibulares-anteriores/1a-fase-2a-fase-comentadas/`, 2021–2026) não separa os arquivos por ano; para não atribuir ano por palpite, ficou de fora. Importar exigiria conferir cada PDF. (As 9 "provas comentadas" já importadas são as de 2007, que a página do ano identifica.) Também não coletadas: provas de habilidades específicas de 2021–2023 e 2025–2026 (nas páginas conferidas — 2022, 2024, 2025, 2026 — a Comvest só publica os "informes" de local/horário; 2021 e 2023 não foram conferidas uma a uma) e, em 2024, as de Dança e Música (não listadas).
- **Não verificável:** nenhuma URL ficou sem verificação. Limitação: o servidor aceita só ~1 req/s; o coletor respeita isso.

### 2.4 Vunesp/Unesp — PARCIAL (não declarar completa)
- **Importado:** 6 edições, 17 arquivos (8 provas, 9 gabaritos; 1 gabarito é "após recursos"), anos **2019–2022**. 2019 e 2020: 1ª fase (caderno e gabarito, versão 1) e 2ª fase (3 cadernos: Linguagens e Códigos, Ciências Humanas, Ciências da Natureza e Matemática). 2021: 2ª fase (caderno e gabarito, versão 1). 2022: 1ª fase (Biológicas; Exatas e Humanas — prova e gabarito de cada). Fonte: portal oficial `vestibular.unesp.br`, seção Arquivo.
- **Verificação:** 17 links ok, 0 quebrados; 17 PDFs baixados e lidos — cada um é o caderno/gabarito do ano, fase e tipo classificados (cabeçalhos "VESTIBULAR 2019…2022", data da prova, "Versão 1"). Nada de HTML.
- **Limitação de acesso:** `www.vunesp.com.br` responde **HTTP 403 "Access Denied" (Akamai)** a qualquer cliente automatizado; é controle de acesso e **não foi contornado**. Fontes de notícias dizem que as provas recentes ficam na "Área do candidato" (login) da Vunesp — também não acessada. Fontes secundárias (cursinhos, portais) existem, mas **não foram usadas** como substitutas.
- **Anos sem prova/gabarito publicados no portal oficial da Unesp:** 2023, 2024, 2025, 2026, 2027 (páginas de documentos conferidas: vestibular, meio de ano, manuais; só listas de convocação, resoluções, manuais, notas de corte). **Anteriores a 2019:** o portal não tem arquivo, e a Vunesp está bloqueada. Primeira edição do Vestibular Unesp por esta via: não confirmada.
- **Só versão 1:** a Unesp divulga publicamente apenas a versão 1 dos cadernos/gabaritos (as demais versões não estão publicadas).
- **Dia da 2ª fase** (2019, 2020): as páginas não identificam dia 1/2; `dia` ficou vazio (os PDFs mostram datas diferentes, ex.: 16.12 e 17.12.2018).
- **Provas de habilidades específicas** (2021 em diante, adiadas por comunicado): sem prova publicada no Arquivo.
- **Não é Vunesp/Unesp:** Olimpíadas Científicas, Unesp-Enem, Provão Paulista (processos seletivos distintos) ficaram fora; não têm provas próprias publicadas.
- **Como ampliar:** (1) o usuário/instituição pode fornecer as páginas da Vunesp salvas, ou liberar o acesso (allowlist/credencial legítima) — então basta ajustar `scripts/coleta/vunesp.py`; (2) repetir `python3 scripts/coleta/vunesp.py` a cada novo vestibular, caso a Unesp publique as provas no portal. Relatório: `data/coleta/vunesp-pendencias.txt`.

### 2.2 Ressalvas das outras coletas
- **ENEM:** 1998–2008 só têm prova na página oficial do Inep (gabarito não listado). O servidor `download.inep.gov.br` envia cadeia de certificados incompleta: do ambiente de desenvolvimento a verificação de links do Inep pode sair "desconhecido" (agora tratado assim, e não como quebrado); navegadores abrem normalmente.
- **Fuvest:** edições antigas (1977–1989 e várias 2ª fases) sem gabarito na página oficial (veja os avisos de `pnpm validar --avisos`).

### 2.3 Próximas instituições (nesta ordem sugerida)
Univesp, Fatec, UERJ, UFPR, UFRGS, PAS/UnB, ITA, IME, EsPCEx, AFA, FGV, Insper, PUC-SP, Mackenzie, Einstein, ESPM. Ainda por fazer no site: página de cobertura, relatórios, filtros de fase/dia, rotina periódica de atualização.

## 3. Confirmar dados das instituições
Os endereços oficiais em `data/instituicoes.json` vieram de conhecimento geral, **não foram verificados online**; confirme todos. Fatec, ITA e AFA estão sem endereço (`null`). Confirme também a "primeira edição" de cada banca (só o ENEM, 1998, está preenchido) e a lista/descrições.

## 4. Publicação e nome
Escolha domínio e hospedagem (o site é estático em quase tudo; roda no Stay Cloud ou na Vercel). Defina `NEXT_PUBLIC_SITE_URL`. "Provas e Gabaritos" é um nome de trabalho: confira disponibilidade e marca antes de divulgar.

## 5. Possíveis próximos passos (não pedidos)
Download em lote por instituição (só com a autorização do item 1), aviso por e-mail de novas edições, contador de downloads e relatório de links quebrados, edição do catálogo por painel em vez de arquivos.
