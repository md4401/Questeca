"""Ferramentas comuns da extração de questões a partir dos PDFs oficiais (Fuvest, Comvest, Uerj, PAS/UnB, PUC-SP, Unesp…).
Uso nos scripts dos subagentes:  import sys; sys.path.insert(0, "<pasta de scripts/extracao>"); from lib import *
Regras: 1 requisição por segundo por servidor, nunca desativar a verificação de TLS, nada de OCR inventado, gabarito só do arquivo oficial."""
import hashlib, json, os, re, subprocess, sys, time, unicodedata
from urllib.parse import urlparse

CACHE = os.environ.get("EXTRACAO_CACHE", "/tmp/extracao-cache")
UA = "Questeca-extracao/1.0 (uso educacional; contato via repositório)"
_last: dict[str, float] = {}

DISCIPLINAS = ["matematica", "lingua-portuguesa", "literatura", "redacao", "historia", "geografia", "biologia", "fisica", "quimica", "filosofia", "sociologia", "ingles", "espanhol", "arte", "ciencias", "interdisciplinar"]

def baixar(url: str) -> str | None:
    """Baixa o PDF para o cache (reaproveita se já existir). Devolve o caminho ou None se falhar (a falha deve ser registrada no relatório)."""
    os.makedirs(CACHE, exist_ok=True)
    dest = os.path.join(CACHE, hashlib.sha1(url.encode()).hexdigest()[:16] + ".pdf")
    if os.path.exists(dest) and os.path.getsize(dest) > 1000: return dest
    host = urlparse(url).netloc
    wait = 1.0 - (time.time() - _last.get(host, 0))
    if wait > 0: time.sleep(wait)
    _last[host] = time.time()
    r = subprocess.run(["curl", "-sL", "-m", "180", "-A", UA, "-o", dest, "-w", "%{http_code} %{content_type}", url], capture_output=True, text=True)
    code, _, ctype = (r.stdout or "").partition(" ")
    if code != "200" or "pdf" not in ctype.lower() and not open(dest, "rb").read(5).startswith(b"%PDF"):
        if os.path.exists(dest): os.remove(dest)
        return None
    return dest

def paginas(pdf: str, layout: bool = False) -> list[str]:
    """Texto por página (pdftotext). Página com pouquíssimo texto indica PDF escaneado (não há OCR aqui)."""
    args = ["pdftotext", "-enc", "UTF-8"] + (["-layout"] if layout else []) + [pdf, "-"]
    out = subprocess.run(args, capture_output=True, text=True).stdout
    return out.split("\f")[:-1] if "\f" in out else [out]

def escaneado(pgs: list[str]) -> bool:
    return sum(len(p.strip()) for p in pgs) < 200 * max(1, len(pgs)) * 0.5

def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9 ]+", " ", unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()).strip()

def limpar(t: str) -> str:
    t = t.replace("­", "").replace("\r", "")
    t = re.sub(r"-\n(?=[a-zà-ú])", "", t)           # hifenização no fim da linha
    t = re.sub(r"[ \t]+\n", "\n", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()

CAMPOS = {"edicao_id", "instituicao", "exam", "ano", "fase", "numero", "disciplina", "titulo", "enunciado", "alternativas", "gabarito", "url_prova", "url_gabarito", "pagina", "versao", "tem_figura", "qualidade", "notas"}
def valida(q: dict) -> list[str]:
    """Devolve a lista de problemas do registro (vazia = aceito)."""
    p = []
    for c in ("edicao_id", "instituicao", "exam", "ano", "numero", "disciplina", "titulo", "enunciado", "alternativas", "url_prova", "qualidade"):
        if q.get(c) in (None, "", []): p.append(f"campo ausente: {c}")
    if q.get("disciplina") not in DISCIPLINAS: p.append("disciplina fora da lista")
    alts = q.get("alternativas") or []
    if not (2 <= len(alts) <= 6) or [a.get("key") for a in alts] != list("ABCDEF")[:len(alts)]: p.append("alternativas devem ser A, B, C… em ordem")
    if any(not str(a.get("text", "")).strip() for a in alts): p.append("alternativa vazia")
    if q.get("gabarito") and q["gabarito"] not in [a.get("key") for a in alts]: p.append("gabarito fora das alternativas")
    if q.get("qualidade") not in ("ok", "revisar"): p.append("qualidade deve ser ok ou revisar")
    if q.get("qualidade") == "ok" and not q.get("gabarito"): p.append("qualidade ok exige gabarito do arquivo oficial")
    if len(q.get("enunciado", "")) < 15: p.append("enunciado curto demais")
    if set(q) - CAMPOS: p.append("campos desconhecidos: " + ",".join(sorted(set(q) - CAMPOS)))
    return p

def gravar(saida_jsonl: str, registros: list[dict]) -> tuple[int, list[tuple[int, list[str]]]]:
    """Acrescenta registros válidos ao JSONL. Devolve (gravados, rejeitados com motivos)."""
    ok, rej = 0, []
    os.makedirs(os.path.dirname(saida_jsonl), exist_ok=True)
    with open(saida_jsonl, "a", encoding="utf-8") as f:
        for q in registros:
            probs = valida(q)
            if probs: rej.append((q.get("numero", -1), probs)); continue
            f.write(json.dumps(q, ensure_ascii=False) + "\n"); ok += 1
    return ok, rej
