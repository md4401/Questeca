"""Vunesp/Unesp — provas e gabaritos do Vestibular Unesp, a partir do portal oficial https://vestibular.unesp.br.

Por que não o site da Vunesp: https://www.vunesp.com.br responde "Access Denied" (Akamai) a clientes automatizados e, segundo a
própria divulgação, as provas recentes ficam na "Área do candidato" (login). Isso é controle de acesso e NÃO é contornado aqui.
O portal da Unesp publica, no "Arquivo", os documentos de cada vestibular; as páginas são montadas por chamadas xajax anônimas,
as mesmas que o navegador de qualquer visitante faz (sem login, sem captcha). 1 requisição por segundo.

Saída: data/coleta/vunesp.csv e data/coleta/vunesp-pendencias.txt (páginas conferidas, itens excluídos, anos sem documentos)."""
import html, re, sys, time, urllib.request, urllib.parse
from urllib.parse import urljoin
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import UA, escrever_csv, formato, sem_acento

BASE = "https://vestibular.unesp.br"
_t = [0.0]

def _espera():
    d = time.time() - _t[0]
    if d < 1: time.sleep(1 - d)
    _t[0] = time.time()

def xj(func, *args):
    _espera()
    data = [("xajax", func), ("xajaxr", str(int(time.time() * 1000)))] + [("xajaxargs[]", str(a)) for a in args]
    req = urllib.request.Request(BASE, data=urllib.parse.urlencode(data).encode(), headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=40).read().decode("utf8", "replace")

def js_args(xml, fn):
    m = re.search(fn + r"\((.*?)\)\s*;?\]\]>", xml, re.S)
    return [a.strip().strip("'") for a in re.findall(r"'[^']*'|[^,]+", m.group(1))] if m else None

def pagina_portal(caminho):
    """HTML do corpo de uma página do portal (ex.: 'arquivo/vestibular-2019/')."""
    a = js_args(xj("exibePaginaUrl", caminho, "inicializa"), "xajax_exibeMeio")
    if not a: return None
    c = js_args(xj("exibeMeio", *a), "xajax_exibeMenu")
    if not c: return None
    cb = js_args(xj("exibeMenu", *c), "xajax_exibeCorpo")
    return html.unescape(xj("exibeCorpo", *cb)) if cb else None

def pagina_get(caminho):
    _espera()
    req = urllib.request.Request(f"{BASE}/{caminho}", headers={"User-Agent": UA})
    return html.unescape(urllib.request.urlopen(req, timeout=40).read().decode("utf8", "replace"))

# (ano do vestibular, página do portal). Para cada ano foram listadas TODAS as páginas de documentos do Arquivo (descobertas a partir de
# https://vestibular.unesp.br/portal#!/arquivo/ e dos menus de cada ano); só as que contêm prova/gabarito geram linhas.
PAGINAS = [
    (2019, "arquivo/vestibular-2019/"), (2020, "arquivo/vestibular-2020/"), (2021, "arquivo/vestibular-2021/"),
    (2022, "arquivo/vestibular-2022/documentos/"), (2022, "arquivo/vestibular-2022/manual-do-candidato/"),
    (2023, "arquivo/vestibular-2023/documentos/"), (2023, "arquivo/vestibular-2023/manual-do-candidato/"),
    (2024, "arquivo/2024/vestibular/documentos/"), (2024, "arquivo/2024/vestibular/manual-do-candidato/"),
    (2024, "arquivo/2024/vestibular-meio-de-ano/documentos/"),
    (2025, "pagina/rlnzv7/vestibular-2025"), (2025, "pagina/33rf3o/vestibular-meio-de-ano-2025"),
    (2026, "pagina/r45hom/documentos-vestibular-unesp-2026"), (2026, "pagina/5afay7/documentos-vestibular-meio-de-ano-2026"),
    (2027, "vestibular-2027/"),
]

INCLUI = re.compile(r"caderno|prova|gabarito", re.I)
EXCLUI = re.compile(r"comunicado|frequ|manual|resolu|isen|reduc|convoc|classific|reop|candvaga|candidato[-_ ]?vaga|minimo|nota|calend|portaria|cronograma|relat|simulado|olimp|enem|provao|chamad|estatist", re.I)

def classificar(titulo, u):
    n = sem_acento(u.rsplit("/", 1)[-1]); t = sem_acento(titulo); tn = n + " " + t
    tipo = "gabarito" if re.search(r"gabarito", tn) else "prova"
    if re.search(r"2a?[-_ ]?fase|segunda fase|especific|linguagens|ciencias (humanas|da natureza)|2afase", tn): fase = "2ª fase"
    elif re.search(r"1a?[-_ ]?fase|primeira fase|gerais|provafase1|cg-1a", tn): fase = "1ª fase"
    else: fase = ""
    m = re.search(r"versao[-_ ]?(\d)", tn)
    versao = f"Versão {m.group(1)}" if m else ""
    if re.search(r"biologicas", tn): versao = (versao + " · " if versao else "") + "Cursos de Biológicas"
    elif re.search(r"exatas ?e ?humanas|exatashumanas", tn): versao = (versao + " · " if versao else "") + "Cursos de Exatas e Humanas"
    return tipo, fase, versao

linhas = []; pend = []; vistos = set(); por_ano = {}
for ano, caminho in PAGINAS:
    fonte = f"{BASE}/portal#!/{caminho}" if not caminho.startswith("pagina/") else f"{BASE}/{caminho}"
    try:
        h = pagina_get(caminho) if caminho.startswith("pagina/") else pagina_portal(caminho)
    except Exception as e:
        h = None; pend.append(f"{ano}: ERRO ao ler {fonte}: {type(e).__name__}")
    if not h:
        pend.append(f"{ano}: página oficial não acessível/inexistente: {fonte}"); continue
    n_prov = 0; n_tot = 0
    for href, t in re.findall(r'href="([^"]+)"[^>]*>(.*?)</a>', h, re.S):
        t = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", t)).strip()
        if not re.search(r"Home/", href) : continue
        u = urljoin(BASE + "/", href); n_tot += 1
        if u in vistos: continue
        if not t: continue   # âncora repetida sem texto (mesmo arquivo já listado com título)
        nome_arq = u.rsplit("/", 1)[-1]
        if not INCLUI.search(t + " " + nome_arq): continue
        if EXCLUI.search(sem_acento(t)) or EXCLUI.search(sem_acento(nome_arq)):
            pend.append(f"{ano}: EXCLUÍDO (não é prova/gabarito): {t[:60]} | {u}"); vistos.add(u); continue
        tipo, fase, versao = classificar(t, u)
        vistos.add(u); n_prov += 1
        tn = sem_acento(t + " " + nome_arq)
        if "linguagens" in tn: area = "Linguagens e Códigos"
        elif "natureza" in tn: area = "Ciências da Natureza e Matemática"
        elif "humanas" in tn and "exatashumanas" not in tn and "exatas e humanas" not in tn: area = "Ciências Humanas"
        elif "biologicas" in tn: area = "Conhecimentos Gerais — Cursos de Biológicas"
        elif "exatas" in tn: area = "Conhecimentos Gerais — Cursos de Exatas e Humanas"
        elif fase == "1ª fase": area = "Conhecimentos Gerais"
        else: area = ""
        pref = "Prova" if tipo == "prova" else ("Gabarito após recursos" if "apos recursos" in tn else "Gabarito")
        v = re.match(r"Versão (\d)", versao)
        rotulo = pref + (f" — {area}" if area and not (pref.startswith("Gabarito após") and not area) else "") + (f" (versão {v.group(1)})" if v else "")
        nome = f"Vunesp {ano} · {fase or 'Provas'}"
        linhas.append(dict(instituicao="vunesp", ano=ano, nome=nome, tipo=tipo, rotulo=rotulo, url=u, formato=formato(u) if re.search(r"\.(pdf|zip|docx?)", u, re.I) else "pdf", fonte=fonte, fase=fase or "Não informada", dia="", aplicacao="", versao=versao, origem="oficial", observacao=""))
    por_ano[ano] = por_ano.get(ano, 0) + n_prov
    print(ano, n_prov, f"({n_tot} links de documentos)", caminho)

escrever_csv("data/coleta/vunesp.csv", linhas)
sem = [a for a in range(2019, 2028) if not por_ano.get(a)]
pend.append(f"anos do Arquivo oficial da Unesp (2019–2027) sem prova/gabarito publicados no portal: {sem}")
pend.append("anos anteriores a 2019: o portal da Unesp não tem arquivo; a Vunesp (www.vunesp.com.br) bloqueia acesso automatizado (HTTP 403 Akamai) e não foi contornada")
open("data/coleta/vunesp-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
print("anos sem documentos:", sem, "| pendências:", len(pend))
