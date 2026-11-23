"""ESPM — Vestibular. Página oficial https://www.espm.br/cursos-de-graduacao/processos-seletivos/vestibular/, bloco "Provas Anteriores".
O semestre de cada par prova/gabarito vem do rótulo "AAAA-N" do bloco e foi conferido no cabeçalho dos PDFs (ex.: "VESTIBULAR 2026/2"). Caderno A.
Saída: data/coleta/espm.csv e espm-pendencias.txt"""
import re, sys
from urllib.parse import urljoin
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, texto, escrever_csv
P = "https://www.espm.br/cursos-de-graduacao/processos-seletivos/vestibular/"
h = baixar(P) or ""
i = h.find("Caderno_de-Prova_"); bloco = h[max(0, i - 400):i + 2500] if i >= 0 else ""
linhas = []; pend = []; atual = None
for m in re.finditer(r'>\s*(20\d\d)-([12])\s*</span>|<a\b[^>]*href="([^"]+\.pdf)"[^>]*>(.*?)</a>', bloco, re.S):
    if m.group(1): atual = (int(m.group(1)), m.group(2)); continue
    u = urljoin(P, m.group(3)); t = texto(m.group(4))
    if not atual or t not in ("Prova", "Gabarito"): continue
    ano, sem_ = atual
    linhas.append(dict(instituicao="espm", ano=ano, nome=f"ESPM {ano}/{sem_} · Vestibular", tipo=t.lower(), rotulo=f"{t} (Caderno A)", url=u, formato="pdf", fonte=P, fase="Prova única", dia="", aplicacao=f"{sem_}º semestre", versao="Caderno A", origem="oficial", observacao="Semestre conferido no cabeçalho do PDF."))
if not linhas: pend.append("bloco 'Provas Anteriores' não encontrado na página oficial")
escrever_csv("data/coleta/espm.csv", linhas)
pend.append("A página oficial só mantém as provas dos dois últimos semestres (2026/1 e 2026/2). Anos anteriores não foram localizados no site (sem página de histórico). Provas por campus (SP/RJ/outros) não são separadas na página: o caderno é único.")
open("data/coleta/espm-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
