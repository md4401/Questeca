"""ENEM — páginas oficiais do Inep, uma por ano (1998 em diante). Saída: data/coleta/enem.csv"""
import re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, links, escrever_csv, formato, sem_acento

BASE = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/enem/provas-e-gabaritos"
CORES = ["azul", "amarelo", "branco", "rosa", "cinza", "laranja", "verde", "vermelho"]

def classificar(rotulo, url):
    nome = url.rsplit("/", 1)[-1]; n = sem_acento(nome); r = sem_acento(rotulo); pasta = sem_acento(url.rsplit("/", 1)[0])
    if "redacao" in r or "redacao" in n: tipo = "outro"
    elif "gabarito" in r or re.search(r"(^|[_/])gb[_.]|^gab|gabarito|_gab[_.]|com_gab", n): tipo = "gabarito"
    else: tipo = "prova"
    m = re.search(r"(?:^|[_/])d(\d)(?:_|\.)", n) or re.search(r"(?:dia|dia_)(\d)", n) or re.search(r"(\d)_dia", n) or re.search(r"dia_?(\d)", n)
    dnum = m.group(1) if m else None
    ppl = bool(re.search(r"ppl|reaplicacao|2_aplicacao", n + " " + pasta)); digital = "digital" in n
    aplic = "Reaplicação (PPL)" if ppl else "ENEM Digital" if digital else "Aplicação regular"
    cd = re.search(r"cd(\d+)|caderno_?(\d+)|_(\d{2})_(?:azul|amarelo|branco|rosa|cinza|laranja|verde)", n)
    cad = next((g for g in (cd.groups() if cd else ()) if g), None)
    cor = next((c for c in CORES if c in n), None)
    var = [v for v in ("superampliada", "ampliada", "ledor", "braile", "libras") if v in n]
    if not var and re.search(r"_sup(_|\.)", n): var = ["superampliada"]
    if not var and re.search(r"_amplia(_|\.)|_amp(_|\.)", n): var = ["ampliada"]
    versao = " ".join(x for x in [f"Caderno {int(cad)}" if cad else "", f"({cor})" if cor else "", *var] if x).strip()
    return tipo, dnum, aplic, versao

linhas = []; pend = []
for ano in range(1998, 2027):
    pg = f"{BASE}/{ano}"
    h = baixar(pg)
    if not h: pend.append(ano); continue
    i = h.find('id="content-core"'); h = h[i:] if i > 0 else h
    vistos = set(); achou = 0
    for rot, u in links(h, pg):
        if not re.search(r"\.(pdf|zip)(\?|$)", u, re.I): continue
        u = u.replace("http://download.inep.gov.br", "https://download.inep.gov.br")
        tipo, dnum, aplic, versao = classificar(rot, u)
        if (tipo, u) in vistos: continue
        vistos.add((tipo, u)); achou += 1
        dia = f"{dnum}º dia" if dnum in ("1", "2") else (f"Aplicação especial (D{dnum})" if dnum else "")
        partes = [f"ENEM {ano}"] + ([dia] if dia else ["Prova única"]) + ([aplic] if aplic != "Aplicação regular" else [])
        rotulo = {"prova": "Prova", "gabarito": "Gabarito", "outro": rot or "Arquivo"}[tipo] + (f" — {versao}" if versao else "") + (f" — {dia}" if dia and tipo == "gabarito" and not versao else "")
        linhas.append(dict(instituicao="enem", ano=ano, nome=" · ".join(partes), tipo=tipo, rotulo=rotulo, url=u, formato=formato(u), fonte=pg, fase="Fase única", dia=dia, aplicacao=aplic, versao=versao))
    if not achou: pend.append(ano)
    print(ano, achou)
escrever_csv("data/coleta/enem.csv", linhas)
print("anos sem arquivos na página oficial:", pend)
