# Missão do subagente: extrair questões objetivas dos PDFs oficiais

Você recebe UM lote (`scripts/extracao/chunks/chunk-NN.json`) com ~25 edições de provas. Cada edição lista arquivos (`tipo` prova/gabarito, `url`, `rotulo`, `versao`).
Objetivo: transformar cada **questão objetiva (de múltipla escolha)** em um registro JSON individual, com o gabarito oficial, para o banco de questões pesquisável da Segunda Lousa.

## Regras (obrigatórias)
1. **Não invente nada.** O enunciado e as alternativas vêm do texto do PDF. O gabarito vem **só do arquivo de gabarito oficial** da mesma edição/versão. Sem gabarito casado → `gabarito: null` e `qualidade: "revisar"`.
2. **Não desative verificação de TLS**, não use proxies alternativos, 1 requisição/s por servidor (a `lib.baixar` já faz isso). Só baixe URLs do seu lote.
3. **Não leia PDFs inteiros no seu contexto.** Escreva scripts Python (regex) com `lib.py` (`baixar`, `paginas`, `limpar`, `gravar`…), rode-os e inspecione só amostras (2–3 questões) e contagens. Reaproveite o mesmo script para edições do mesmo formato.
4. PDF escaneado (sem texto; `escaneado(pgs)` verdadeiro): **não há OCR** neste ambiente → pule e registre em `pulados` com o motivo.
5. Provas **discursivas** (sem alternativas) → pule (`motivo: "discursiva"`). Só questões com alternativas A, B, C… entram.
6. Várias versões/cadernos da mesma prova (V1/V2, cor A/B…) têm as mesmas questões: extraia **uma** versão (a primeira prova) e use o gabarito **dessa** versão.
7. Se a questão depende de figura/gráfico/tabela que o texto não traz: mantenha o texto, `tem_figura: true`, e `qualidade: "revisar"`. Informe a `pagina` (1ª página da questão no PDF).
8. `disciplina`: use um valor da lista de `lib.DISCIPLINAS`. Se a prova indica a disciplina, use-a; se não, classifique por palavras-chave com um script e confira amostras; se incerto use `interdisciplinar`.
9. `titulo`: resumo curto (até ~70 caracteres) do assunto da questão, escrito por você a partir do enunciado (não copie o enunciado inteiro).
10. `qualidade: "ok"` somente se: enunciado completo, alternativas completas em ordem, gabarito oficial casado, sem dependência de figura. Caso contrário `revisar`.
11. Valide com `lib.valida`/`lib.gravar`. Conferências por edição: números sequenciais sem buracos; nº de gabaritos = nº de questões; se não bater, não grave a edição inteira como "ok" — marque `revisar` e descreva no relatório.

## Saída (a pasta `OUT` é indicada no seu prompt)
- `OUT/chunk-NN.jsonl` — uma questão por linha, campos conforme `lib.CAMPOS`: `edicao_id, instituicao, exam, ano, fase, numero, disciplina, titulo, enunciado, alternativas[{key,text}], gabarito, url_prova, url_gabarito, pagina, versao, tem_figura, qualidade, notas`.
  - `exam` = nome da edição do lote (ex.: "Fuvest 2020 · 1ª fase"); `instituicao` = slug do lote.
- `OUT/chunk-NN.relatorio.json` — `{ "edicoes": { "<id>": { "status": "extraida|parcial|pulada|falhou", "questoes": n, "ok": n, "revisar": n, "gabaritos": n, "motivo": "..." } }, "falhas_download": [urls], "observacoes": "..." }`.
- Escreva o relatório **sempre**, mesmo se tudo falhar.
Ao terminar, responda com um resumo curto: edições extraídas/puladas/falhas, total de questões, quantas `ok`, e problemas conhecidos. Não cole o conteúdo das questões na resposta.
