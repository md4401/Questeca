"""Fuvest — Acervo dos vestibulares (uma página por ano, 1977 em diante). Saída: data/coleta/fuvest.csv"""
import re, sys
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, links, escrever_csv, formato, sem_acento

BASE = "https://www.fuvest.br/acervo-vestibular"
EXCLUI = re.compile(r"manual|nota[s_-]*de[_-]*corte|chamad|espera|relacao|inscrit|analise|convocad|qase|matricula|resolucao|programa|lista|ultimo|classificacao|edital|locais|estatistic|perfil|candidato[_-]vaga|opcao|resultado|cursos|vagas|carreira|simulado|regulamento|guia", re.I)

def fase_de(n, texto):
    n = sem_acento(n); t = sem_acento(texto)
    if re.search(r"2[a_ -]*fase|fase[_-]?2|segunda|dia[_-]?[12]|2fase", n) or re.search(r"[12]. dia", t): return "2ª fase"
    if re.search(r"1[a_ -]*fase|fase[_-]?1|primeira|1fase", n): return "1ª fase"
    return ""

linhas = []; sem = []
for ano in range(1977, 2027):
    pg = f"{BASE}-{ano}" + ("/" if ano == 2026 else "")
    h = baixar(pg)
    if not h: sem.append(ano); continue
    i = h.find("entry-content"); h = h[i:] if i > 0 else h
    achou = 0; vistos = set()
    for rot, u in links(h, pg):
        if not re.search(r"\.pdf(\?|$)", u, re.I) or "fuvest.br" not in u or u in vistos: continue
        nome_arq = u.rsplit("/", 1)[-1]
        if EXCLUI.search(nome_arq) or EXCLUI.search(sem_acento(rot)): continue
        n = sem_acento(nome_arq); r = sem_acento(rot)
        if not re.search(r"prova|gabarito|caderno|questoes|fase|dia|resolu|comentad|1dia|2dia", n + " " + r): continue
        tipo = "gabarito" if re.search(r"gabarito|gab[._-]|respostas", n + " " + r) else "comentada" if re.search(r"comentad|resolucao", n + " " + r) else "prova"
        fase = fase_de(nome_arq, rot)
        dia = re.search(r"([12])[ºo°]? ?dia", r) or re.search(r"dia[_-]?([12])", n)
        dia = f"{dia.group(1)}º dia" if dia else ""
        vistos.add(u); achou += 1
        nome = f"Fuvest {ano}" + (f" · {fase}" if fase else " · Provas") + (f" · {dia}" if dia else "")
        rotulo = {"prova": "Prova", "gabarito": "Gabarito", "comentada": "Resolução"}[tipo] + (f" — {dia}" if dia else "") + (f" ({rot})" if rot and sem_acento(rot) not in ("prova", "provas", "gabarito", "gabaritos", "1o dia", "2o dia") and tipo != "gabarito" else "")
        linhas.append(dict(instituicao="fuvest", ano=ano, nome=nome, tipo=tipo, rotulo=rotulo, url=u, formato=formato(u), fonte=pg, fase=fase or "Não informada", dia=dia))
    if not achou: sem.append(ano)
    print(ano, achou)
escrever_csv("data/coleta/fuvest.csv", linhas)
print("anos sem prova/gabarito na página:", sem)
