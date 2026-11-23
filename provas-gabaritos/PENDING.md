# PENDING — o que ainda precisa de pesquisa, autorização ou decisão humana

Os números por instituição são gerados em `data/relatorio-coleta.md` (`pnpm relatorio --salvar`) e aparecem no site em `/cobertura`. Este arquivo lista só pendências reais.

## 1. Decisões e autorizações (bloqueiam a publicação)
1. **Direitos autorais.** Provas e gabaritos pertencem às instituições. O site **só aponta** para os arquivos oficiais (redirecionamento), sem copiar nem hospedar. Hospedar cópias ou gerar pacotes ZIP exigiria autorização de cada titular — não implementado. Revisar o texto de `/sobre` com um advogado e definir `NEXT_PUBLIC_CONTATO`.
2. **Publicar na Vercel** — preparado (README, seção “Publicação”), **não publicado**. Falta autorização expressa, escolha do domínio/DNS e `NEXT_PUBLIC_SITE_URL`.
3. **Nome do projeto** (“Provas e Gabaritos” é nome de trabalho): conferir disponibilidade e marca.

## 2. Instituições sem nenhum documento — acesso bloqueado ou nada publicado (detalhes e erros em `data/coleta/bloqueios.md`)
| Instituição | Motivo | Para destravar |
|---|---|---|
| Univesp | HTTP 403 (desafio Cloudflare) | acesso legítimo ao site/arquivos ou páginas salvas |
| Fatec | HTTP 403 (desafio Cloudflare) | idem |
| UFRGS | conexão encerrada pelo servidor em todas as tentativas (host inacessível daqui) | rodar o coletor de uma rede com acesso ou fornecer as páginas salvas de `www.ufrgs.br/coperse` |
| IME | host sem conexão | idem |
| EsPCEx | host sem conexão | idem |
| AFA | HTTP 403 (Cloudflare) em `fab.mil.br` | idem |
| Insper | HTTP 403 (Akamai) | idem |
| Albert Einstein | páginas do vestibular exigem JavaScript / 403; nenhum link de prova localizado | idem |
| FGV | página oficial “Provas e Gabaritos” abre, mas **não lista arquivos** | reconferir periodicamente |

Nenhuma fonte não oficial (cursinhos, portais de notícia) foi usada no lugar das oficiais. Quando houver acesso, crie `scripts/coleta/<slug>.py` seguindo `uerj.py`/`ita.py`.

## 3. Instituições com acervo parcial (o que falta e por quê)
- **VUNESP/Unesp:** só 2019–2022 (portal da Unesp; só versão 1 dos cadernos). 2023–2027: o portal só tem convocações/resoluções; provas recentes ficam na área do candidato (login) da Vunesp; `www.vunesp.com.br` bloqueia acesso automatizado. Antes de 2019: nada localizado. Dia da 2ª fase não indicado nas páginas.
- **UFPR:** só 2 documentos (prova de Compreensão e Produção de Textos 2019; prova objetiva de Música 2024). O portal do Núcleo de Concursos não publica as provas da 1ª fase em nenhum PS2018–PS2027. Vestibular passa a fase única em 2027. Algumas páginas de processo listam poucos documentos por vez (possível paginação não explorada).
- **PAS/UnB:** 2016–2025 (a API do Cebraspe tem subprogramas a partir de 2014–2016; etapas de 2014/2015 e as de 2026 ainda sem arquivos). Excluídas “justificativas de alteração de gabarito”.
- **PUC-SP:** Verão 2015 a Verão 2027, com lacunas (ex.: provas de 2016–2017 e de Inverno 2015 sem caderno identificável; 3 arquivos de Inverno 2015/2017 e Verão 2016 sem nome claro ficaram de fora). Os arquivos “Correção da prova – Parte A/B” (2021–2023) são o próprio caderno (conferido) e estão como prova. Processos complementares (vagas remanescentes/ENEM) ficaram de fora.
- **Mackenzie:** só a edição 2026/2 está publicada nas páginas oficiais dos campi; sem acervo histórico localizado.
- **ESPM:** só 2026/1 e 2026/2 (a página mantém dois semestres).
- **ITA:** 2008–2027, mas a página oficial não distingue a fase nas provas por disciplina anteriores a 2019 (ficam como “Prova por disciplina”); sem anos anteriores a 2008.

## 4. Instituições com acervo amplo, mas com lacunas conhecidas (nada foi fabricado)
- **COMVEST/Unicamp (1987–2027):** sem gabarito/respostas esperadas em 1987–2002, 2003 (2ª fase) e 2023 (1ª fase); 2027 só 1ª fase; provas comentadas 2021–2026 não importadas (a página não separa por ano); 5 links oficiais indisponíveis retirados; “Expectativas da banca de redação” 2016–2017 com fase “Não informada”.
- **Fuvest (1977–2026):** edições antigas e várias 2ª fases sem gabarito na página oficial (ver `pnpm validar --avisos`).
- **ENEM (1998–2026, 98 edições):** 1998–2008 só têm prova na página do Inep; **ENEM 2012** ficou sem edição porque a única entrada da página oficial aponta para um arquivo da pasta de 2011 (provável erro do Inep; o arquivo foi mantido só em 2011).
- **UERJ (2012–2027):** nada anterior a 2012 localizado no portal; 2020: o ano do 1º Exame de Qualificação foi atribuído pela data da prova (09/06/2019); gabaritos “anulada/retificado” identificados no rótulo.

## 5. Verificação
- **ENEM/Inep:** `download.inep.gov.br` envia cadeia de certificados incompleta; do ambiente de coleta os links ficam “sem confirmação” (desconhecido), não “quebrado”; navegadores abrem normalmente. O conteúdo desses PDFs não pôde ser baixado/lido aqui (a verificação TLS não foi desativada).
- **PDFs escaneados** não têm texto extraível; nesses casos só o endereço e o tipo foram conferidos (ex.: Fuvest antigas, PAS/UnB 2016, ITA 2026 – Física).
- A conferência de **conteúdo** foi por amostragem (≈70 PDFs de 8 instituições, anos e tipos variados), não de todos os arquivos.
- Reconferir os links periodicamente (`pnpm links`), pois as bancas movem arquivos.

## 6. Próximos passos sugeridos (não pedidos)
Coletores para as instituições bloqueadas assim que houver acesso legítimo; importar as provas comentadas da Comvest após conferir cada PDF; página “última atualização” e rotina agendada (`scripts/coletar-tudo.sh`); download em lote por instituição somente com a autorização do item 1.1.
