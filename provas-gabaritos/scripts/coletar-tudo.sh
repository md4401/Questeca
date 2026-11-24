#!/usr/bin/env bash
# Atualização periódica do catálogo: roda os coletores que funcionam, importa, valida e confere os links.
# Uso: bash scripts/coletar-tudo.sh            (todos)   |   bash scripts/coletar-tudo.sh uerj ita   (só alguns)
# Cada coletor lê só páginas oficiais, 1 requisição por segundo, e grava data/coleta/<instituicao>.csv + <instituicao>-pendencias.txt.
set -euo pipefail
cd "$(dirname "$0")/.."
TODOS=(enem fuvest comvest vunesp uerj ufpr pas_unb ita pucsp mackenzie espm)
SEL=("${@:-${TODOS[@]}}")
for c in "${SEL[@]}"; do
  echo "== coletando $c"; python3 "scripts/coleta/$c.py"
  slug="${c//_/-}"; [ "$slug" = "pucsp" ] && slug="puc-sp"
  [ -f "data/coleta/${c//_/-}.csv" ] && pnpm exec tsx scripts/importar-csv.ts "data/coleta/${c//_/-}.csv" || pnpm exec tsx scripts/importar-csv.ts "data/coleta/$c.csv"
done
pnpm exec tsx scripts/gerar-dados.ts
pnpm exec tsx scripts/validar.ts --avisos | tail -5
NODE_USE_ENV_PROXY=1 pnpm exec tsx scripts/verificar-links.ts --novos
pnpm exec tsx scripts/relatorio.ts --salvar
