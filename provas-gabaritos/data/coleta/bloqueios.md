# Instituições sem coleta (ou parcial) por limitação de acesso — tentativas registradas

Data das tentativas: 2026-11-23. Cliente identificado (`provas-gabaritos-coleta/0.2`), 1 requisição/s, sem contornar bloqueios.
Regras seguidas: nada de falsificar navegador, resolver CAPTCHA/desafio, usar credenciais ou fontes não oficiais no lugar das oficiais.

| Instituição | O que foi tentado | Resultado observado | Situação |
|---|---|---|---|
| Univesp | `https://www.univesp.br/`, `https://univesp.br/`, `https://vestibular.univesp.br/`, `…/vestibular` | HTTP 403, página "Just a moment…" (desafio Cloudflare). `sistemas.univesp.br`: sem conexão | **Não coletada** (bloqueio anti-bot) |
| Fatec | `https://vestibular.fatec.sp.gov.br/`, `https://www.vestibularfatec.com.br/`, `https://www.fatec.sp.gov.br/`, `https://www.cps.sp.gov.br/` | `vestibular.fatec.sp.gov.br`: HTTP 403 (Cloudflare "Just a moment…"); `cps.sp.gov.br`: sem conexão; os demais sem resposta útil | **Não coletada** |
| UFRGS | `https://www.ufrgs.br/coperse/`, `…/cv-2024/`, `…/concurso-vestibular-anteriores/`, `www1.ufrgs.br`, `lume.ufrgs.br`, http/https | Conexão encerrada pelo servidor durante o handshake (`ws_closed_mid_exchange`, "Connection reset by peer") em todas as tentativas e repetições. Páginas oficiais existem (apareceram na busca), mas não foi possível abri-las | **Não coletada** (host inacessível a partir do ambiente) |
| IME | `https://www.ime.eb.mil.br/`, `https://ime.eb.mil.br/`, `…/index.php` | Sem conexão (host inacessível pelo proxy de saída) | **Não coletada** |
| EsPCEx | `https://www.espcex.eb.mil.br/`, `https://espcex.eb.mil.br/`, `https://www.dceem.eb.mil.br/` | Sem conexão. `https://www.eb.mil.br/` abre, mas não leva às provas | **Não coletada** |
| AFA | `https://www.fab.mil.br/`, `…/afa`, `https://www2.fab.mil.br/afa/`, `https://www.afa.aer.mil.br/`, `https://www.epcar.aer.mil.br/` | `fab.mil.br`: HTTP 403 (desafio Cloudflare); os demais hosts sem conexão | **Não coletada** |
| Insper | `https://www.insper.edu.br/`, `…/pt/graduacao`, `…/ingresso`, `https://ingresso.insper.edu.br/` | HTTP 403 "Access Denied" (Akamai) / sem conexão | **Não coletada** |
| FGV | `https://vestibular.fgv.br/` e `…/provas-gabaritos` (abrem); `portal.fgv.br`, `eesp/eaesp/ebape/emap/direitosp.fgv.br` | A página oficial "Provas e Gabaritos" **não lista nenhum arquivo** na data da coleta (HTML sem links de documentos; só menus). Páginas das escolas não têm provas anteriores | **Sem documentos publicados** |
| Albert Einstein | `https://www.einstein.br/ensino/graduacao` (HTTP 403), `https://ensino.einstein.br/portal-graduacoes/vestibular`, `…/graduacao_em_medicina_gradtp1/p`, `https://vestibular.einstein.br/` | `ensino.einstein.br` abre mas o conteúdo do vestibular é montado por JavaScript e não traz links de prova/gabarito; `www.einstein.br` 403; `vestibular.einstein.br` sem conexão | **Não coletada** |
| Vunesp (site) | `https://www.vunesp.com.br/`, `…/UNES2601` | HTTP 403 "Access Denied" (Akamai). Coletado apenas o que o portal oficial da Unesp publica (2019–2022) | **Parcial** |

## Como retomar
- Se a instituição liberar o acesso (ou você fornecer as páginas salvas / uma rede com acesso), crie `scripts/coleta/<slug>.py` seguindo `uerj.py`/`ita.py` (leem só a página oficial, classificam por cabeçalho/nome do arquivo e geram `data/coleta/<slug>.csv`), rode `pnpm importar`, `pnpm validar`, `pnpm links --instituicao <slug>` e `pnpm relatorio --salvar`.
- Fontes não oficiais (cursinhos, portais de notícia) existem para vários desses exames, mas **não foram usadas** como substitutas.
