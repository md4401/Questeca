"""UERJ — Vestibular Estadual: Exames de Qualificação (1º e 2º), Exame Discursivo e Exame Único, 2012–2027.
Páginas oficiais em https://www.vestibular.uerj.br (WordPress; ?page_id=N). Cada edição tem página própria; os ids abaixo foram lidos do
menu oficial e o título/arquivos de cada página foram conferidos. Saída: data/coleta/uerj.csv e data/coleta/uerj-pendencias.txt."""
import re, sys
from urllib.parse import urljoin
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import baixar, links, texto, escrever_csv, formato, sem_acento

B = "https://www.vestibular.uerj.br/"
pg = lambda i: f"{B}?page_id={i}" if i != 15701 else f"{B}?p=15701"

EQ1, EQ2, ED, UNICO = "1º Exame de Qualificação", "2º Exame de Qualificação", "Exame Discursivo", "Exame Único"
# (ano, etapa, id da página, observação)
PAGINAS = [
    (2019, EQ1, 6445, ""), (2019, EQ2, 6700, ""), (2019, ED, 6530, ""),
    (2020, EQ1, 7641, "Ano atribuído pela data da prova (09/06/2019): 1º Exame de Qualificação do vestibular de ingresso 2020."),
    (2020, EQ2, 8539, ""), (2020, ED, 9245, ""),
    (2021, UNICO, 11072, ""), (2022, UNICO, 12028, ""), (2023, UNICO, 12911, ""),
    (2024, EQ1, 13475, ""), (2024, EQ2, 13774, ""), (2024, ED, 13975, ""),
    (2025, EQ1, 14486, ""), (2025, EQ2, 14817, ""), (2025, ED, 15203, ""),
    (2026, EQ1, 15701, ""), (2026, EQ2, 15994, ""), (2026, ED, 16334, ""),
    (2027, EQ1, 16862, ""), (2027, EQ2, 17124, ""),
]
ANTERIORES = pg(7069)  # "Provas e Gabaritos Anteriores": 2012–2018 num só quadro, arquivos nomeados AAAA_1eq_prova.pdf etc.

DISC = {"redacao": "Redação", "fisica": "Física", "historia": "História", "biologia": "Biologia", "geografia": "Geografia", "lpl": "Língua Portuguesa e Literaturas", "lp_lb": "Língua Portuguesa e Literaturas", "lpi": "Língua Portuguesa e Literaturas (LPI)", "lingua_estrangeira": "Língua Estrangeira", "linguas_estrangeiras": "Língua Estrangeira", "lingua_estrangeira": "Língua Estrangeira", "estrangeiras": "Língua Estrangeira", "espanhol": "Espanhol", "frances": "Francês", "ingles": "Inglês", "matematica": "Matemática", "quimica": "Química", "lp": "Língua Portuguesa e Literaturas"}
def disc_de(texto_rot, nome):
    n = sem_acento(re.sub(r"\.pdf.*$", "", nome))
    n = re.sub(r"^(\d{4}_)?(ed_)?(pr_)?", "", n); n = re.sub(r"_1(_retificado)?$|_retificado$", "", n)
    return DISC.get(n) or texto_rot

linhas = []; pend = []; vistos = set()
def add(ano, etapa, tipo, rotulo, u, fonte, obs=""):
    if u in vistos: return
    vistos.add(u)
    nome = f"UERJ {ano} · {etapa}"
    linhas.append(dict(instituicao="uerj", ano=ano, nome=nome, tipo=tipo, rotulo=rotulo, url=u.replace("http://", "https://"), formato=formato(u), fonte=fonte, fase=etapa, dia="", aplicacao="", versao="", origem="oficial", observacao=obs))

def arquivos_da(pagina_url):
    h = baixar(pagina_url) or ""
    i = h.find("entry-content"); body = h[i:] if i > 0 else h
    j = body.find("<footer"); body = body[:j] if j > 0 else body
    return [(texto(t), urljoin(B, u)) for t, u in links(body, B) if re.search(r"\.(pdf|zip)", u, re.I) and "LEI-N" not in u], bool(h)

# ---- 2012–2018 (quadro de anteriores)
arqs, ok = arquivos_da(ANTERIORES)
if not ok: pend.append(f"página de anteriores inacessível: {ANTERIORES}")
for t, u in arqs:
    nome = u.rsplit("/", 1)[-1]
    m = re.match(r"(\d{4})_(1eq|2eq)_(prova|gabarito)", nome, re.I)
    if m:
        ano = int(m.group(1)); etapa = EQ1 if m.group(2).lower() == "1eq" else EQ2
        tipo = m.group(3).lower()
        add(ano, etapa, tipo, ("Prova" if tipo == "prova" else "Gabarito") + (" (retificado)" if re.search(r"retific|alterado", nome, re.I) else ""), u, ANTERIORES); continue
    m = re.match(r"(\d{4})_ED_(PR_)?(.+)\.pdf", nome, re.I)
    if m:
        ano = int(m.group(1)); pr = bool(m.group(2)); d = disc_de(t, nome)
        add(ano, ED, "gabarito" if pr else "prova", ("Padrão de resposta — " if pr else "Prova — ") + d, u, ANTERIORES); continue
    pend.append(f"anteriores: IGNORADO (nome fora do padrão): {t} | {u}")

# ---- 2019–2027 (uma página por edição)
for ano, etapa, pid, obs in PAGINAS:
    fonte = pg(pid); arqs, ok = arquivos_da(fonte)
    if not ok or not arqs: pend.append(f"{ano} {etapa}: página sem arquivos/inacessível {fonte}"); continue
    for t, u in arqs:
        nome = u.rsplit("/", 1)[-1]; n = sem_acento(nome); tn = sem_acento(t)
        if re.search(r"simulado", n + tn): pend.append(f"{ano}: EXCLUÍDO (simulado): {nome}"); vistos.add(u); continue
        if etapa == ED:
            ul = u.lower()
            padrao = bool(re.search(r"_pr_|/padroes/|padrao|/padrao", ul) or re.search(r"_1(_retificado)?\.pdf$|_retificado\.pdf$", n) or re.search(r"(espanhol|frances|ingles|pr_ing)", n))
            d = disc_de(t, nome)
            add(ano, ED, "gabarito" if padrao else "prova", ("Padrão de resposta — " if padrao else "Prova — ") + d, u, fonte, obs)
        else:
            if re.search(r"padrao", tn): tipo, r = "gabarito", "Padrão de resposta — Redação"
            elif re.search(r"gabarito", tn + n): tipo, r = "gabarito", "Gabarito" + (" (retificado)" if "retific" in n else "") + (" (anulada)" if "anulad" in n else "")
            elif re.search(r"redacao", tn + n): tipo, r = "prova", "Prova — Redação"
            elif re.search(r"prova|questoes|exame", tn + n): tipo, r = "prova", "Prova" if "objetiv" not in tn else "Prova — Questões objetivas"
            else: pend.append(f"{ano} {etapa}: não classificado, ignorado: {t} | {u}"); continue
            add(ano, etapa, tipo, r, u, fonte, obs)
    print(ano, etapa, len(arqs))

escrever_csv("data/coleta/uerj.csv", linhas)
anos = sorted({int(l["ano"]) for l in linhas})
pend.append(f"anos coletados: {anos[0]}–{anos[-1]} ({len(anos)} anos). Pré-2012: não há quadro/páginas de provas anteriores localizadas no portal oficial (a página 'Provas e Gabaritos Anteriores' começa em 2012).")
open("data/coleta/uerj-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
