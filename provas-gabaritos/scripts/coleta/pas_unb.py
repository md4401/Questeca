"""PAS/UnB — Programa de Avaliação Seriada (Cebraspe). Só o PAS; o vestibular tradicional da UnB não entra.
Fonte oficial: API pública que alimenta https://www.cebraspe.org.br/pas/subprogramas (apis.cebraspe.org.br), arquivos em cdn.cebraspe.org.br.
Cada subprograma (trio de etapas) e cada etapa têm registro próprio. Saída: data/coleta/pas-unb.csv e pas-unb-pendencias.txt"""
import json, re, sys, time, urllib.request, urllib.parse
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from util import UA, escrever_csv, formato, sem_acento

API = "https://apis.cebraspe.org.br/cebraspe/"
CDN = "https://cdn.cebraspe.org.br/"
def get(u):
    time.sleep(1)
    return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": UA}), timeout=40))

linhas = []; pend = []
subs = get(API + "pas/subprogramas")
for s in subs:
    for e in s["etapas"]:
        det = get(f"{API}pas/subprogramas/{s['periodo']}/{e['etapa']}")
        fonte = f"https://www.cebraspe.org.br/pas/subprogramas/{s['periodo']}/{e['etapa']}"
        arqs = det.get("arquivosGabarito") or []
        if not arqs:
            pend.append(f"PAS {e['etapa']} {s['periodo']} ({e['anoEtapa']}): etapa sem arquivos de prova/gabarito na API (prova realizada em {det.get('dataProva','?')[:10]})"); continue
        for a in arqs:
            d = a["descricaoArquivo"]; dn = sem_acento(d)
            if not re.search(r"\.(pdf|zip)$", a["nomeArquivo"], re.I) and a["tipoExtensaoArquivo"].upper() not in ("PDF", "ZIP"): continue
            if re.search(r"justificativa", dn): pend.append(f"{e['anoEtapa']} PAS {e['etapa']}: EXCLUÍDO (justificativas de alteração, não é gabarito): {d[:60]}"); continue
            if re.search(r"gabar?ito|gabrito", dn): tipo, pref = "gabarito", "Gabarito"
            elif re.search(r"padrao", dn): tipo, pref = "gabarito", "Padrão de resposta"
            elif re.search(r"caderno|prova|capa", dn): tipo, pref = "prova", "Prova"
            else: pend.append(f"{e['anoEtapa']} PAS {e['etapa']}: não classificado: {d[:60]}"); continue
            m = re.search(r"caderno ([a-zà-ú]+)", dn)
            versao = ("Caderno " + m.group(1).capitalize()) if m else ""
            if re.search(r"adaptad|super|ledor", dn): versao += (" · " if versao else "") + ("Adaptada" if "adaptad" in dn else "Superampliada" if "super" in dn else "Ledor")
            rotulo = f"{pref} — {re.sub(r'(?i)^(gabarito definitivo|padr[aã]o (definitivo )?de resposta( definitivo)?|prova)\\s*[-–]?\\s*', '', d).strip()[:80] or d[:80]}" if pref != "Prova" else f"Prova — {re.sub(r'(?i)^pas \\d\\s*-\\s*', '', d).title()[:80]}"
            url = CDN + urllib.parse.quote(a["nomeArquivo"], safe="/")
            nome = f"PAS/UnB {e['anoEtapa']} · Etapa {e['etapa']} · Subprograma {s['periodo'].replace('_','-')}"
            linhas.append(dict(instituicao="pas-unb", ano=e["anoEtapa"], nome=nome, tipo=tipo, rotulo=rotulo, url=url, formato="pdf", fonte=fonte, fase=f"Etapa {e['etapa']}", dia="", aplicacao=f"Subprograma {s['periodo'].replace('_','-')}", versao=versao, origem="oficial", observacao=""))
        print(e["anoEtapa"], "etapa", e["etapa"], len(arqs))
escrever_csv("data/coleta/pas-unb.csv", linhas)
pend.append("Subprogramas anteriores a 2014–2016 não constam da API do Cebraspe (primeiro subprograma listado: 2014-2016).")
open("data/coleta/pas-unb-pendencias.txt", "w", encoding="utf-8").write("\n".join(pend) + "\n")
