"""PUC-SP — Vestibular (Verão = 1º semestre do ano seguinte? NÃO: usa o nome oficial "Verão AAAA"/"Inverno AAAA").
Fonte: NucVest (https://nucvest.com.br), organizadora do vestibular da PUC-SP; https://www.pucsp.br/vestibular redireciona para lá.
Cada edição tem página própria (pucsp/vestibular/AAAA/...); a união dos arquivos de prova/gabarito de todas as páginas é deduplicada por URL e
classificada pelo nome do arquivo/pasta (semestre e ano). Saída: data/coleta/pucsp.csv e pucsp-pendencias.txt"""
import re, sys
from urllib.parse import urljoin, unquote
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, links, escrever_csv, sem_acento

B = "https://nucvest.com.br/"
idx = baixar(B + "processos-anteriores.html") or ""
paginas = []
for t, u in links(idx, B + "processos-anteriores.html"):
    if re.search(r"/pucsp/(vestibular/|vestibular-)", u) and u not in [p for p, _ in paginas]: paginas.append((u, t))
if not paginas: sys.exit("índice de processos anteriores inacessível")

EXCL = re.compile(r"complementar|^vc[-_]|edital|relacao|lista|manual|cursos[_-]?dispon|aditivo|matricula|chamada|resultado|estatist|calendario|cronograma|inscri|taxa|isencao|cota|portaria|regulamento|guia|tutorial|simulado|enem", re.I)
achados = {}   # url -> (texto, página)
for u, t in paginas:
    h = baixar(u)
    if not h: continue
    for tx, uu in links(h, u):
        uu = uu.replace("https://www.nucvest.com.br/", B).replace("http://", "https://")
        if not re.search(r"\.(pdf|zip)(\?|$)", uu, re.I) or "nucvest.com.br/downloads/pucsp" not in uu: continue
        if re.search(r"/vestibular/\d{4}/(inverno|verao)/|/vestibular/\d{4}/[^/]+\.pdf", uu) and False: pass
        achados.setdefault(uu, (tx, u))
print(len(paginas), "páginas;", len(achados), "PDFs distintos")

linhas = []; pend = []
for uu, (tx, pagina) in sorted(achados.items()):
    arq = unquote(uu.rsplit("/", 1)[-1]); pasta = unquote(uu.split("/downloads/pucsp/")[1])
    ref = sem_acento(arq); pn = sem_acento(pasta)
    if EXCL.search(ref) or EXCL.search(sem_acento(tx)): pend.append(f"EXCLUÍDO: {arq} ({tx[:40]})"); continue
    if not re.search(r"gabarito|gaba\d|caderno|prova|correcao|direito-autoral|d-autoral|a4-v\d", ref): pend.append(f"IGNORADO (nome sem prova/gabarito): {arq}"); continue
    sem_ = "Verão" if re.search(r"verao", ref) else ("Inverno" if re.search(r"inverno", ref) else ("Verão" if "verao" in pn else ("Inverno" if "inverno" in pn else "")))
    ano = re.search(r"(?:verao|inverno)[-_ ]?(20\d\d)|(20\d\d)[-_ ]?(?:verao|inverno)|(?:verao|inverno)(20\d\d)", ref) or re.search(r"(20\d\d)", ref) or re.search(r"(?:verao|inverno)[-_]?(20\d\d)|(20\d\d)", pn)
    if not (sem_ and ano):
        pend.append(f"NÃO CLASSIFICADO (semestre/ano indeterminado): {pasta}"); continue
    a = int(next(g for g in ano.groups() if g))
    # "prova_pucsp2018verao" (pasta verao-2017) = Verão 2018: o ano do nome do arquivo manda
    tipo = "gabarito" if re.search(r"gabarito|gaba\d", ref) else "prova"   # "Correção da Prova – Parte A/B" é o próprio caderno (conferido: traz enunciados da Redação e das questões)
    pref = {"gabarito": "Gabarito", "prova": "Prova (caderno de questões)"}[tipo]
    parte = re.search(r"parte[-_ ]?([ab])", ref)
    versao = ""
    if re.search(r"retificad|republicad", ref): pref += " (retificado)" if "retificad" in ref else " (republicado)"
    rotulo = pref + (f" — Parte {parte.group(1).upper()}" if parte else "")
    obs = "Semestre e ano deduzidos do nome do arquivo/pasta oficial." + (" O site oficial chama este arquivo de \"Correção da prova\"; o conteúdo é o caderno da prova (Redação e questões)." if "correcao" in ref else "")
    linhas.append(dict(instituicao="puc-sp", ano=a, nome=f"PUC-SP {sem_} {a}", tipo=tipo, rotulo=rotulo, url=uu, formato="pdf", fonte=pagina, fase="Prova", dia="", aplicacao=sem_, versao=versao, origem="oficial", observacao=obs))
vis = {}; 
for l in linhas:
    k = (l["aplicacao"], l["ano"], re.sub(r"[^a-z0-9]", "", sem_acento(unquote(l["url"].rsplit("/", 1)[-1]))))
    if k not in vis or ("/vestibular/" in l["url"] and "/vestibular/" not in vis[k]["url"]): vis[k] = l
linhas = list(vis.values())
escrever_csv("data/coleta/pucsp.csv", linhas)
anos = sorted({(l['ano'], l['aplicacao']) for l in linhas}); print(anos)
pend.append("Edições anteriores a Verão 2016 não localizadas nas páginas oficiais do NucVest/PUC-SP (consultadas as páginas de 'Processos anteriores').")
open("data/coleta/pucsp-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
