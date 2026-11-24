"""COMVEST/Unicamp — provas, gabaritos ("respostas esperadas") e documentos de prova por edição.
Cada edição tem páginas próprias no site oficial; as páginas abaixo foram todas descobertas a partir de
https://www.comvest.unicamp.br/vestibulares-anteriores/ e dos índices de ingresso (ingresso-AAAA).
Saída: data/coleta/comvest.csv  (e data/coleta/comvest-pendencias.txt com o que foi excluído/ficou de fora)."""
import re, sys
from urllib.parse import urljoin
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, texto, escrever_csv, formato, sem_acento

B = "https://www.comvest.unicamp.br/"
VA = B + "vestibulares-anteriores/"

# (ano, página, hint) — hint: "resp" = a página inteira é de respostas esperadas; "" = decidir por arquivo/cabeçalho
PAGINAS = []
def add(ano, url, hint=""): PAGINAS.append((ano, url, hint))

# 1987–2003: a própria página do ano traz os PDFs (vestibular-1997-01 = 1997 … vestibular-1997-10 = 1988; títulos conferidos)
add(1987, VA + "vestibular-1987/")
for n in range(1, 11): add(1998 - n, VA + f"vestibular-1997-{n:02d}/")
for a in range(1998, 2004): add(a, VA + f"vestibular-{a}/")
# 2004–2018: subpáginas "Provas" e "Respostas esperadas" (slug varia; endereços lidos das páginas dos anos)
SUB = {
 2004: ("provas-e-habilidades-especificas-2004", "respostas-esperadas-2004"),
 2005: ("provas-e-habilidades-especificas-2005", "respostas-esperadas-2005"),
 2006: ("provas-e-habilidades-especificas-2007", "respostas-esperadas-2007"),
 2007: ("provas-e-habilidades-especificas-2007", "respostas-esperadas-2007"),
 2008: ("provas-e-habilidades-especificas-2008", "respostas-esperadas-2008"),
 2009: ("provas-e-habilidades-especificas-2009", "respostas-esperadas-2009"),
 2010: ("provas-e-habilidades-especificas-2011", "respostas-esperadas-2011"),
 2011: ("provas-e-habilidades-especificas-2011", "respostas-esperadas-2012"),
 2012: ("1a-fase-2a-fase-habilidades-especificas-2012", "1a-fase-2a-fase-respostas-esperadas-2012"),
 2013: ("1a-fase-2a-fase-habilidades-especificas-2013", "1a-fase-2a-fase-respostas-esperadas-2013"),
 2014: ("1a-fase-2a-fase-habilidades-especificas-2014", "1a-fase-2a-fase-respostas-esperadas-2014"),
 2015: ("1a-fase-2a-fase-habilidades-especificas", "1a-fase-2a-fase-respostas-esperadas"),
 2016: ("1a-fase-2a-fase-habilidades-especificas", "1a-fase-2a-fase"),
 2017: ("provas-e-habilidades-especificas-2017", "respostas-esperadas-2017"),
 2018: ("provas-e-habilidades-especificas-2018", "respostas-esperadas-2018"),
}
for a, (p, r) in SUB.items():
    add(a, VA + f"vestibular-{a}/{p}/"); add(a, VA + f"vestibular-{a}/{r}/", "resp")
# 2019–2020
add(2019, VA + "ingresso-2019/vestibular-2019/provas-2019/"); add(2019, VA + "ingresso-2019/vestibular-2019/respostas-esperadas-2019/", "resp")
add(2020, VA + "ingresso-2020/vestibular-2020/provas-2020/"); add(2020, VA + "ingresso-2020/vestibular-2020/respostas-esperadas-2020/", "resp")
# 2021–2027
add(2021, B + "ingresso-2021-comvest/vestibular-2021/provas/")
add(2022, B + "ingresso-2022/vestibular-2022/provas/")
add(2023, B + "ingresso-2023/vestibular-2023/provas/")
add(2024, B + "ingresso-2024/vestibular-2024-2/area-doa-candidatoa/")
add(2024, B + "ingresso-2024/vestibular-2024-2/")          # provas de habilidades específicas (Informe: wp-content/uploads/2024/05)
add(2025, B + "ingresso-2025/vestibular-2025/area-doa-candidatoa/")
add(2026, B + "ingresso-2026/vestibular-2026/provas-e-gabaritos-vestibular-2026/")
add(2027, B + "ingresso-2027/vestibular-2027/")

EXCLUI = re.compile(r"abstenc|freq\d|frequencia|manual|programa|edital|diretriz|esclarec|relatorio|desempenho|trilogia|relacao|nota[s_-]|isencao|informa_|informa-|informa\b|informacoes|comentarios_|simulado|regulamento|guia|lista|chamad|resolucao|cota|senha|musica_upload|lista-de-livros|vagas|retifica|reducao|beneficiad|nao_aptos|contemplad|recusad|aprovad|resultado", re.I)
# Links publicados na página oficial, mas que o servidor da Comvest recusa/não encontra (verificado em 2026-11-23 com navegador-like e com o verificador do projeto).
INDISPONIVEIS = {
    "https://www.comvest.unicamp.br/wp-content/uploads/2020/06/2020-Musica-Licenciatura.docx": "HTTP 403",
    "https://www.comvest.unicamp.br/wp-content/uploads/2020/06/2018-Musica-Licenciatura.docx": "HTTP 403",
    "https://www.comvest.unicamp.br/wp-content/uploads/2020/06/PHE-Musica-2018-Teoria.docx": "HTTP 403",
    "https://www.comvest.unicamp.br/vest2004/F2/provas/Musica.zip": "HTTP 404",
    "https://www.comvest.unicamp.br/vest2002/F2/solucao_enigma.pdf": "HTTP 404 (e é um enigma/curiosidade, não prova)",
}
EXT = re.compile(r"\.(pdf|docx?|zip)(\?|$)", re.I)

def fase_por_url(u):
    if re.search(r"/F1/", u): return "1ª fase"
    if re.search(r"/F2/", u): return "2ª fase"
    return ""

def classificar(ano, pag, hint, u, rot, hfase, hdia, htipo):
    nome_arq = u.rsplit("/", 1)[-1]; n = sem_acento(nome_arq); r = sem_acento(rot); u_l = u.lower()
    antigo = "/vest_anteriores/" in u_l            # PDFs de 1987–2003 (pasta download/)
    # --- tipo
    if re.search(r"errata", n + " " + r): tipo = "outro"
    elif re.search(r"coment", n + " " + r): tipo = "comentada"
    elif re.search(r"gabarito|respost|esperad|expectativ|expec|resp\.pdf$|resp_|resp\d*\.pdf$|[a-z]resp\.pdf$", n) or hint == "resp" and not re.search(r"/F[12]/(provaf1|f1\d{4})", u): tipo = "gabarito"
    elif hint == "resp": tipo = "gabarito"
    elif re.search(r"/vest\d{4}/F[12]/", u) or antigo: tipo = "prova"
    elif htipo == "gabarito": tipo = "gabarito"
    else: tipo = "prova"
    # --- fase
    fase = fase_por_url(u)
    if not fase and antigo:
        fase = "1ª fase" if re.search(r"fase1|fasei\b|fasei\.|expecred", n) or re.search(r"redacao e questoes gerais", r) else "2ª fase"
    if not fase: fase = hfase
    # sem pasta F1/F2 nem cabeçalho: "gabaritoAAAA" é o gabarito da prova objetiva (1ª fase); "<disciplina>resp" são respostas esperadas discursivas (2ª fase)
    if not fase and re.search(r"^gabarito[_-]?\d{4}", n): fase = "1ª fase"
    if not fase and re.search(r"^(qui|fis|bio|his|mat|geo|port|ing)resp", n): fase = "2ª fase"
    if not fase and re.search(r"dia[_-]?[12]|[12]o[_-]?dia|[12]odia|2fase|f2", n): fase = "2ª fase"
    he = bool(re.search(r"aptidao|habilidade|arquitet|cenica|visuais|danca|musica|odontolog|artistica|ed_artistica|artes[-_]|HE_", n + " " + r, re.I)) and not re.search(r"portbio|fisgeo", n)
    if he and not fase: fase = "2ª fase"
    # --- dia
    dia = ""
    m = re.search(r"(?:^|[^0-9])([12])\s*[ºo°]?\s*[-_ ]?dia|dia[-_ ]?([12])(?!\d)|([12])odia|\bdia ([12])\b", n + " " + r)
    if m and fase != "1ª fase": dia = f"{next(g for g in m.groups() if g)}º dia"
    elif hdia: dia = hdia
    # --- versão (Provas Q e Z / Prova X)
    ver = ""
    m = re.search(r"\b(?i:provas?|gabaritos?) ([A-Z](?: e [A-Z])?)\b", rot)
    if m: ver = m.group(1)
    return tipo, fase, dia, ver, he

linhas = []; pend = []; vistos = set(); anos_ok = {}
for ano, pag, hint in PAGINAS:
    h = baixar(pag)
    if not h:
        pend.append(f"{ano}: página oficial não acessível/inexistente: {pag}"); continue
    i = h.find("entry-content"); h = h[i:] if i > 0 else h
    j = h.find("<footer"); h = h[:j] if j > 0 else h
    hfase = ""; hdia = ""; htipo = "prova"; n_pag = 0
    for m in re.finditer(r'<(h[1-6])[^>]*>(.*?)</\1>|<a\b[^>]*?href="([^"#][^"]*)"[^>]*>(.*?)</a>', h, re.S | re.I):
        if m.group(1):
            t = sem_acento(texto(m.group(2)))
            hdia = ""
            if re.search(r"primeira fase|1a fase", t): hfase = "1ª fase"
            elif re.search(r"segunda fase|2a fase", t): hfase = "2ª fase"
            if re.search(r"habilidades", t): hfase = "2ª fase"
            if re.search(r"gabarito|resposta", t): htipo = "gabarito"
            elif re.search(r"^prova", t): htipo = "prova"
            continue
        href = m.group(3).strip(); rot = texto(m.group(4))
        malf = bool(re.match(r"^p://", href)); href = re.sub(r"^p://", "https://", href)   # href malformado na página oficial de 2019
        u = urljoin(pag, href)
        if "comvest.unicamp.br" not in u or not EXT.search(u): continue
        if u in vistos: continue
        if u in INDISPONIVEIS:
            pend.append(f"{ano}: LINK OFICIAL INDISPONÍVEL ({INDISPONIVEIS[u]}): {rot[:50]} | {u}"); vistos.add(u); continue
        if not rot and not re.search(r"/F[12]/|vest_anteriores", u) is None: pass
        if not rot:
            pend.append(f"{ano}: IGNORADO (link sem rótulo, duplicata de outro link da página): {u}"); vistos.add(u); continue
        nome_arq = u.rsplit("/", 1)[-1]
        if EXCLUI.search(sem_acento(nome_arq)) or EXCLUI.search(sem_acento(rot)):
            pend.append(f"{ano}: EXCLUÍDO (não é prova/gabarito): {rot[:50]} | {u}"); vistos.add(u); continue
        tipo, fase, dia, ver, he = classificar(ano, pag, hint, u, rot, hfase, hdia, htipo)
        md = re.search(r"dia (\d{1,2}/\d{1,2})", sem_acento(rot))
        if md and fase == "1ª fase": hdia = f"Dia {md.group(1)}"; dia = hdia
        elif hdia and fase == "1ª fase": dia = hdia
        vistos.add(u); n_pag += 1
        # 1988 teve dois vestibulares
        bloco = "2º vestibular" if "/1988_2/" in u else ("1º vestibular" if ano == 1988 else "")
        nome = f"Comvest {ano}" + (f" ({bloco})" if bloco else "") + (f" · {fase}" if fase else " · Provas") + (f" · {dia}" if dia else "") + (" · Habilidades Específicas" if he else "")
        pref = {"prova": "Prova", "gabarito": "Respostas esperadas" if re.search(r"esperad|expectativ|resp", sem_acento(nome_arq + " " + rot)) and not re.search(r"gabarito", sem_acento(nome_arq + rot)) else "Gabarito", "outro": "Errata", "comentada": "Prova comentada"}[tipo]
        if ver: rotulo = f"{pref} — versão {ver}"
        else:
            t = re.sub(r"^(vestibular \d{4} ?[-–] ?)", "", rot, flags=re.I)
            t = "" if sem_acento(t) in ("", "provas", "prova", "gabarito", "clique para acessar", "questoes gerais") and tipo != "prova" else t
            t = re.sub(r"^(prova comentada|prova|gabaritos?|provas)( d[aeo]s?)?\W*", "", t, flags=re.I); t = t[:1].upper() + t[1:]
            rotulo = f"{pref} — {t[:80]}" if t and sem_acento(t) not in ("prova", "provas") else pref
        linhas.append(dict(instituicao="comvest", ano=ano, nome=nome, tipo=tipo, rotulo=rotulo, url=u, formato=formato(u), fonte=pag, fase=fase or "Não informada", dia=dia, aplicacao=("Habilidades Específicas" if he else ""), versao=ver, origem="oficial", observacao=("Link oficial com erro de protocolo (p://) corrigido para https://" if malf else "")))
    anos_ok[ano] = anos_ok.get(ano, 0) + n_pag
    print(ano, n_pag, pag.replace(B, ""))

escrever_csv("data/coleta/comvest.csv", linhas)
sem = [a for a in range(1987, 2028) if not anos_ok.get(a)]
pend.append(f"anos sem nenhum arquivo coletado: {sem}")
open("data/coleta/comvest-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
print("anos sem arquivos:", sem, "| excluídos/pendências:", len(pend))
