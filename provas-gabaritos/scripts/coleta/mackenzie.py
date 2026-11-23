"""Mackenzie — Vestibular (Universidade Presbiteriana Mackenzie). Páginas oficiais por campus em
https://www.mackenzie.br/processos-seletivos/vestibular-graduacao/<campus>; cada uma tem 'Ver provas anteriores' e 'Consultar gabaritos'.
Saída: data/coleta/mackenzie.csv e mackenzie-pendencias.txt"""
import re, sys
from urllib.parse import urljoin, unquote
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, links, escrever_csv, sem_acento
B = "https://www.mackenzie.br/processos-seletivos/vestibular-graduacao/"
CAMPI = ["sao-paulo-higienopolis", "universidade-campus-alphaville", "universidade-campus-campinas"]
achados = {}; pend = []
for c in CAMPI:
    h = baixar(B + c)
    if not h: pend.append(f"página do campus inacessível: {B+c}"); continue
    for t, u in links(h, B + c):
        n = unquote(u.rsplit("/", 1)[-1])
        if re.search(r"\.pdf", u, re.I) and re.search(r"^(prova|gabarito)[_-]", n, re.I):
            u = u.replace("http://", "https://").replace("https://backend.mackenzie.br/", "https://www.mackenzie.br/")
            achados.setdefault(u, (t, B + c, []))[2].append(c)
linhas = []
for u, (t, fonte, campi) in achados.items():
    n = unquote(u.rsplit("/", 1)[-1]); ref = sem_acento(n)
    m = re.search(r"_(\d{4})_(\d)", n); d = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", n)
    if not m: pend.append(f"não classificado (semestre indeterminado): {n}"); continue
    ano, sem_ = int(m.group(1)), m.group(2)
    tipo = "gabarito" if ref.startswith("gabarito") else "prova"
    linhas.append(dict(instituicao="mackenzie", ano=ano, nome=f"Mackenzie {ano}/{sem_}º semestre · Vestibular", tipo=tipo, rotulo=("Gabarito" if tipo == "gabarito" else "Prova") + (f" (aplicada em {d.group(1)}/{d.group(2)}/{d.group(3)})" if d else ""), url=u, formato="pdf", fonte=fonte, fase="Prova única", dia="", aplicacao=f"{sem_}º semestre", versao="", origem="oficial", observacao=f"Mesmo arquivo publicado nas páginas dos campi: {', '.join(sorted(set(campi)))}."))
escrever_csv("data/coleta/mackenzie.csv", linhas)
pend.append("As páginas oficiais dos campi publicam apenas a prova e o gabarito da edição mais recente (2026/2). Não foi localizado acervo de provas anteriores no site (buscas em /processos-seletivos/ sem página de histórico).")
open("data/coleta/mackenzie-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
