#!/usr/bin/env python3
"""Recorta as FIGURAS (gráficos, tabelas, mapas, esquemas) das questões a partir dos PDFs oficiais.
Uso: python3 extrair_figuras.py <entrada.jsonl> <pasta-saida> [--cache DIR ...] [--limite N] [--filtro-inst slug]
Para cada questão com tem_figura: acha o PDF no cache (sha1 da url_prova), localiza o início da questão na página
(primeiras palavras do enunciado), delimita até o início da próxima questão e recorta os blocos gráficos
(imagens embutidas + desenhos vetoriais agrupados) dentro dessa região. Saída: PNG (64 cores) por figura + manifesto JSONL."""
import sys, os, re, json, hashlib, unicodedata, argparse, collections
import pdfplumber, pypdfium2 as pdfium
from PIL import Image

def norm(s): return re.sub(r"[^a-z0-9]+", "", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower())
def sha(url): return hashlib.sha1(url.encode()).hexdigest()[:16] + ".pdf"

def acha_pdf(url, caches):
    for c in caches:
        p = os.path.join(c, sha(url))
        if os.path.exists(p): return p
    return None

def palavras(page):
    ws = page.extract_words(use_text_flow=True, keep_blank_chars=False)
    return [(norm(w["text"]), w) for w in ws if norm(w["text"])]

def acha_inicio(ws, enun, usado=None):
    toks = [norm(t) for t in re.findall(r"\S+", enun)[:40]]
    toks = [t for t in toks if t][:6]
    if len(toks) < 3: return None
    seq = [t for t, _ in ws]
    for n in (len(toks), 4, 3):
        alvo = toks[:n]
        for i in range(len(seq) - n + 1):
            if seq[i:i + n] == alvo: return ws[i][1]
    return None

def duas_colunas(page):
    ws = page.extract_words()
    if len(ws) < 40: return False
    W = page.width
    esq = sum(1 for w in ws if w["x1"] < W * 0.53); dir_ = sum(1 for w in ws if w["x0"] > W * 0.47)
    return esq > len(ws) * 0.3 and dir_ > len(ws) * 0.3

def blocos_graficos(page, box):
    """Imagens embutidas + desenhos vetoriais dentro da caixa, agrupados em regiões."""
    x0, y0, x1, y1 = box
    itens = []
    for im in page.images: itens.append((im["x0"], im["top"], im["x1"], im["bottom"], "img"))
    for r in page.rects + page.curves: itens.append((r["x0"], r["top"], r["x1"], r["bottom"], "vec"))
    for l in page.lines: itens.append((l["x0"], l["top"], l["x1"], l["bottom"], "lin"))
    dentro = [(a, b, c, d, k) for a, b, c, d, k in itens if a >= x0 - 2 and c <= x1 + 2 and b >= y0 - 2 and d <= y1 + 2 and (c - a) < (x1 - x0) * 1.02]
    # descarta filetes de página (linhas finas largas) e caixas minúsculas
    dentro = [t for t in dentro if not (t[4] == "lin" and (t[3] - t[1]) < 1 and (t[2] - t[0]) > (x1 - x0) * 0.9)]
    grupos = []
    for a, b, c, d, k in sorted(dentro, key=lambda t: t[1]):
        for g in grupos:
            if a <= g[2] + 14 and c >= g[0] - 14 and b <= g[3] + 14 and d >= g[1] - 14:
                g[0], g[1], g[2], g[3] = min(g[0], a), min(g[1], b), max(g[2], c), max(g[3], d); g[4].add(k); break
        else: grupos.append([a, b, c, d, {k}])
    out = []
    for a, b, c, d, ks in grupos:
        w, h = c - a, d - b
        if ("img" in ks and w > 40 and h > 30) or (len(ks) >= 1 and w > 90 and h > 50 and ("vec" in ks or "lin" in ks)):
            out.append((a, b, c, d))
    return out

def processa(rows, cachedirs, saida, limite=None):
    os.makedirs(saida, exist_ok=True)
    por_pdf = collections.defaultdict(list)
    for r in rows:
        if r.get("url_prova"): por_pdf[r["url_prova"]].append(r)
    feitos = []; stats = collections.Counter()
    for url, qs in por_pdf.items():
        pdf = acha_pdf(url, cachedirs)
        if not pdf: stats["sem_pdf"] += len([q for q in qs if q.get("tem_figura")]); continue
        try: doc = pdfplumber.open(pdf); rend = pdfium.PdfDocument(pdf)
        except Exception: stats["pdf_ruim"] += 1; continue
        qs = sorted(qs, key=lambda q: (q.get("numero") or 0))
        cache_pg = {}
        def pg(i):
            if i not in cache_pg:
                p = doc.pages[i]; cache_pg[i] = (p, palavras(p), duas_colunas(p))
            return cache_pg[i]
        inicios = {}
        for q in qs:  # posição de início de cada questão (para delimitar o fim da anterior)
            p0 = (q.get("pagina") or 1) - 1
            for i in (p0, p0 + 1, p0 - 1):
                if 0 <= i < len(doc.pages):
                    w = acha_inicio(pg(i)[1], q["enunciado"])
                    if w: inicios[id(q)] = (i, w); break
        for k, q in enumerate(qs):
            if not q.get("tem_figura"): continue
            if limite and stats["figuras_ok"] >= limite: return feitos, stats
            ini = inicios.get(id(q))
            if not ini: stats["inicio_nao_achado"] += 1; continue
            i, w = ini
            p, ws, col2 = pg(i)
            W, H = p.width, p.height
            if col2 and w["x0"] > W * 0.47: cx0, cx1 = W * 0.47, W
            elif col2: cx0, cx1 = 0, W * 0.53
            else: cx0, cx1 = 0, W
            top = max(0, w["top"] - 4)
            # fim: início da próxima questão na mesma página/coluna; senão fim da página
            bottom = H - 30
            for nq in qs[k + 1:]:
                n = inicios.get(id(nq))
                if n and n[0] == i and n[1]["top"] > top + 20 and (not col2 or (n[1]["x0"] > W * 0.47) == (w["x0"] > W * 0.47)):
                    bottom = n[1]["top"] - 2; break
                if n and n[0] != i: break
            blocos = blocos_graficos(p, (cx0, top, cx1, bottom))
            if not blocos: stats["sem_grafico"] += 1; continue
            arqs = []
            for j, (a, b, c, d) in enumerate(blocos[:3]):
                m = 6
                box = (max(0, a - m), max(0, b - m), min(W, c + m), min(H, d + m))
                img = rend[i].render(scale=2.2, crop=(box[0], H - box[3] - 0, W - box[2], box[1] - 0)) if False else None
                bitmap = rend[i].render(scale=2.2)
                pil = bitmap.to_pil()
                s = 2.2
                pil = pil.crop((int(box[0] * s), int(box[1] * s), int(box[2] * s), int(box[3] * s)))
                nome = f"{q['edicao_id']}__{q['numero']}__{j}.png"
                if pil.width > 1100: pil = pil.resize((1100, int(pil.height * 1100 / pil.width)))
                pil.convert("RGB").quantize(colors=64, method=Image.MEDIANCUT).save(os.path.join(saida, nome), "PNG", optimize=True)
                arqs.append({"arquivo": nome, "w": pil.width, "h": pil.height})
            stats["figuras_ok"] += 1
            feitos.append({"instituicao": q["instituicao"], "exam": q["exam"], "ano": q["ano"], "fase": q.get("fase"), "numero": q["numero"], "imagens": arqs, "pagina": i + 1})
    return feitos, stats

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("entrada"); ap.add_argument("saida")
    ap.add_argument("--cache", action="append", default=[]); ap.add_argument("--limite", type=int); ap.add_argument("--inst")
    a = ap.parse_args()
    rows = [json.loads(l) for l in open(a.entrada) if l.strip()]
    if a.inst: rows = [r for r in rows if r["instituicao"] == a.inst]
    feitos, stats = processa(rows, a.cache or ["/tmp/extracao-cache"], a.saida, a.limite)
    with open(os.path.join(a.saida, "manifesto.jsonl"), "w") as f:
        for x in feitos: f.write(json.dumps(x, ensure_ascii=False) + "\n")
    print(dict(stats))
