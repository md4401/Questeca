#!/usr/bin/env python3
"""Gera src/data/provas-oficiais.json a partir do catálogo da pasta provas-gabaritos/data (branch versao-professores).
Uso: python3 scripts/gerar-provas-oficiais.py <pasta provas-gabaritos/data>
O catálogo só aponta para arquivos nos sites oficiais; nada é copiado ou hospedado."""
import json, glob, os, sys
src = sys.argv[1] if len(sys.argv) > 1 else "provas-gabaritos/data"
inst = json.load(open(f"{src}/instituicoes.json"))
ver = json.load(open(f"{src}/verificacao.json"))
bad = {u for u, v in ver.items() if v.get("status") == "quebrado"}
eds = []
for f in sorted(glob.glob(f"{src}/edicoes/*.json")):
    for e in json.load(open(f)):
        eds.append({
            "id": e["id"], "s": e["instituicao"], "a": e["ano"], "n": e["nome"],
            **({"f": e["fase"]} if e.get("fase") else {}), **({"d": e["dia"]} if e.get("dia") else {}),
            **({"ap": e["aplicacao"]} if e.get("aplicacao") else {}), **({"fo": e["fonte"]} if e.get("fonte") else {}),
            "ar": [{"t": a["tipo"], "r": a["rotulo"], "u": a["url"], "fm": a.get("formato", "pdf"), **({"v": a["versao"]} if a.get("versao") else {}), **({"x": 1} if a["url"] in bad else {})} for a in e.get("arquivos", [])],
        })
out = {"instituicoes": [{"slug": i["slug"], "nome": i["nome"], "sigla": i["sigla"], "aliases": i.get("aliases", []), "site": i.get("site"), "observacao": i.get("observacao")} for i in inst], "edicoes": eds}
os.makedirs("src/data", exist_ok=True)
json.dump(out, open("src/data/provas-oficiais.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(eds), "edições,", sum(len(e["ar"]) for e in eds), "arquivos")
