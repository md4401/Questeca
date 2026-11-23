/** Valida o catálogo (esquema, ids, URLs, anos). Sai com erro se algo estiver inválido — roda antes do build. */
import { validarCatalogo } from "../src/lib/validacao";
import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "../src/lib/dados";

const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
for (const e of r.erros) console.error("ERRO ", e);
if (process.argv.includes("--avisos")) for (const a of r.avisos) console.warn("aviso", a);
console.log(`${r.instituicoes.length} instituições · ${r.edicoes.length} edições · ${r.edicoes.reduce((n, e) => n + e.arquivos.length, 0)} arquivos · ${r.erros.length} erro(s) · ${r.avisos.length} aviso(s)`);
process.exit(r.erros.length ? 1 : 0);
