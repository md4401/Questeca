"""Utilitários dos coletores. Só biblioteca padrão do Python 3. Gentil com os servidores: 1 requisição por segundo, User-Agent identificado."""
import csv, html, re, sys, time, urllib.request, urllib.error, unicodedata

UA = "provas-gabaritos-coleta/0.2 (catalogo de links publicos; contato no site)"
CAMPOS = ["instituicao", "ano", "nome", "tipo", "rotulo", "url", "formato", "fonte", "fase", "dia", "aplicacao", "versao", "origem", "observacao"]
_ultimo = [0.0]

def baixar(url, tentativas=2, pausa=1.0):
    for t in range(tentativas):
        espera = pausa - (time.time() - _ultimo[0])
        if espera > 0: time.sleep(espera)
        _ultimo[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
            with urllib.request.urlopen(req, timeout=40) as r:
                raw = r.read(); cs = r.headers.get_content_charset() or "utf-8"
                return raw.decode(cs, errors="replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410): return None
            if t == tentativas - 1: print(f"  ! HTTP {e.code} {url}", file=sys.stderr); return None
        except Exception as e:
            if t == tentativas - 1: print(f"  ! {type(e).__name__} {url}", file=sys.stderr); return None
    return None

def texto(h): return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h or ""))).strip()
def sem_acento(s): return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()

def links(pagina_html, base=None):
    """(texto, url absoluta) de todos os <a href>."""
    from urllib.parse import urljoin
    out = []
    for m in re.finditer(r'<a\b[^>]*?href="([^"#][^"]*)"[^>]*>(.*?)</a>', pagina_html or "", flags=re.S | re.I):
        u = html.unescape(m.group(1)).strip()
        if u.lower().startswith(("javascript:", "mailto:", "tel:")): continue
        out.append((texto(m.group(2)), urljoin(base, u) if base else u))
    return out

def escrever_csv(arquivo, linhas):
    with open(arquivo, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=CAMPOS, delimiter=";", extrasaction="ignore")
        w.writeheader()
        for l in linhas: w.writerow({k: l.get(k, "") for k in CAMPOS})
    print(f"{arquivo}: {len(linhas)} linhas")

def formato(url):
    m = re.search(r"\.(pdf|zip|docx?|rar)(\?|$)", url, re.I)
    f = (m.group(1).lower() if m else "outro")
    return {"doc": "docx", "rar": "outro"}.get(f, f)
