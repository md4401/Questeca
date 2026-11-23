"""ITA — Vestibular. Site oficial da Comissão do Vestibular: https://www.vestibular.ita.br (página provas.htm = "Provas anteriores"; principal.htm traz a edição mais recente).
www.ita.br responde 403 (desafio Cloudflare) a clientes automatizados — não é usado. Saída: data/coleta/ita.csv e ita-pendencias.txt"""
import html, re, sys, urllib.request
from urllib.parse import urljoin
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import UA, escrever_csv, sem_acento
import time
B = "https://www.vestibular.ita.br/"
def pagina(nome):
    time.sleep(1)
    return urllib.request.urlopen(urllib.request.Request(B + nome, headers={"User-Agent": UA}), timeout=40).read().decode("latin1", "replace")
DISC = {"matematica": "Matemática", "fisica": "Física", "quimica": "Química", "portugues": "Português", "ingles": "Inglês", "redacao": "Redação"}
linhas = []; pend = []; vistos = set()
for nome in ("provas.htm", "principal.htm"):
    h = pagina(nome); fonte = B + nome
    for href, t in re.findall(r'href="(provas/[^"]+\.pdf)"[^>]*>(.*?)</a>', h, re.S | re.I):
        u = urljoin(B, href)
        if u in vistos: continue
        arq = href.rsplit("/", 1)[-1].lower(); m = re.search(r"(20\d\d)", arq)
        if not m: pend.append(f"sem ano no nome: {arq}"); continue
        ano = int(m.group(1)); vistos.add(u)
        d = next((v for k, v in DISC.items() if arq.startswith(k)), "")
        if arq.endswith("_2f.pdf") or "2f" in arq or "criterios" in arq or "expectativas" in arq: fase = "2ª fase"
        elif "fase1" in arq or (arq.startswith("gabarito") and ano >= 2019): fase = "1ª fase"
        else: fase = "Prova por disciplina"
        if arq.startswith("gabarito") or "gabaritos" in arq or "expectativas" in arq:
            tipo = "gabarito"; rot = "Gabarito" + (" — critérios de pontuação" if "criterios" in arq else " — expectativas da banca de redação" if "expectativas" in arq else "")
        else:
            tipo = "prova"; rot = "Prova" + (f" — {d}" if d else "")
        nomeEd = f"ITA {ano} · {fase}"
        linhas.append(dict(instituicao="ita", ano=ano, nome=nomeEd, tipo=tipo, rotulo=rot, url=u, formato="pdf", fonte=fonte, fase=fase, dia="", aplicacao="", versao="", origem="oficial", observacao="A página oficial não distingue a fase nas provas por disciplina anteriores a 2019." if fase == "Prova por disciplina" else ""))
escrever_csv("data/coleta/ita.csv", linhas)
pend.append("A página oficial lista 'alguns anos anteriores' (2008–2026 + 2027 na página principal). Anos anteriores a 2008 não foram localizados. www.ita.br inacessível (403 Cloudflare), não contornado.")
open("data/coleta/ita-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
