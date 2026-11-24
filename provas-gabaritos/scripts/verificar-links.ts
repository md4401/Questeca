/**
 * Confere se cada link do catálogo ainda responde e aponta para um arquivo (PDF/ZIP).
 *   pnpm links                      # todos
 *   pnpm links --instituicao enem   # só uma
 *   pnpm links --novos              # só os ainda não verificados
 * Grava data/verificacao.json (o site mostra o resultado). Educado com os servidores: poucas requisições
 * por vez e com intervalo. Rode no seu computador (o ambiente do desenvolvimento pode não alcançar os sites oficiais).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { EDICOES_BRUTAS, INSTITUICOES_BRUTAS, VERIFICACAO_BRUTA } from "../src/lib/dados";
import { validarCatalogo } from "../src/lib/validacao";

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] ?? "" : null; };
const so = arg("instituicao"); const novos = process.argv.includes("--novos");
const r = validarCatalogo({ instituicoes: INSTITUICOES_BRUTAS, edicoes: EDICOES_BRUTAS, verificacao: VERIFICACAO_BRUTA });
if (r.erros.length) { console.error(r.erros.join("\n")); process.exit(1); }
const atual = JSON.parse(readFileSync("data/verificacao.json", "utf8")) as Record<string, { status: string; httpStatus: number | null; contentType: string | null; verificadoEm: string }>;
const urls = [...new Set(r.edicoes.filter((e) => !so || e.instituicao === so).flatMap((e) => e.arquivos.map((a) => a.url)))].filter((u) => !novos || !atual[u]);
console.log(`Verificando ${urls.length} link(s)…`);
const UA = "provas-gabaritos-verificador/0.1 (conferencia de links publicos)";
const hoje = new Date().toISOString().slice(0, 10);
// Os arquivos do catálogo são PDF/ZIP/Word: uma resposta 200 em HTML costuma ser página de erro ("soft 404"), então não vale como ok.
const ESPERADO = /pdf|zip|octet-stream|msword|officedocument|binary/i;

async function checar(url: string) {
  const tenta = async (metodo: "HEAD" | "GET") => {
    const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 25_000);
    try { return await fetch(url, { method: metodo, redirect: "follow", headers: { "User-Agent": UA, ...(metodo === "GET" ? { Range: "bytes=0-0" } : {}) }, signal: ac.signal }); } finally { clearTimeout(t); }
  };
  try {
    let res = await tenta("HEAD");
    if (res.status === 405 || res.status === 403 || res.status === 501) res = await tenta("GET");
    const ct = res.headers.get("content-type");
    const ok = res.status >= 200 && res.status < 400 && (!ct || ESPERADO.test(ct));
    return { status: ok ? "ok" : "quebrado", httpStatus: res.status, contentType: ct, verificadoEm: hoje };
  } catch (e) {
    // Servidor com cadeia de certificados incompleta (ex.: Inep): não dá para afirmar que o link está quebrado — navegadores costumam abrir normalmente.
    const causa = JSON.stringify([(e as { cause?: { code?: string } })?.cause?.code, (e as Error)?.message]);
    const cert = /CERT|SELF_SIGNED|UNABLE_TO_VERIFY|ISSUER/i.test(causa);
    return { status: cert ? "desconhecido" : "quebrado", httpStatus: null, contentType: null, verificadoEm: hoje };
  }
}

async function main() {
  let feitos = 0;
  const fila = [...urls];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (fila.length) {
      const u = fila.shift()!;
      atual[u] = await checar(u);
      if (++feitos % 25 === 0) { writeFileSync("data/verificacao.json", JSON.stringify(atual, null, 2) + "\n"); console.log(`${feitos}/${urls.length}`); }
      await new Promise((res) => setTimeout(res, 400));
    }
  }));
  // Remove entradas de URLs que já não estão no catálogo (ex.: links retirados por estarem indisponíveis).
  const noCatalogo = new Set(r.edicoes.flatMap((e) => e.arquivos.map((a) => a.url)));
  for (const k of Object.keys(atual)) if (!noCatalogo.has(k)) delete atual[k];
  writeFileSync("data/verificacao.json", JSON.stringify(atual, null, 2) + "\n");
  const quebrados = urls.filter((u) => atual[u]?.status === "quebrado");
  console.log(`Pronto: ${urls.length - quebrados.length} ok, ${quebrados.length} com problema.`);
  for (const u of quebrados) console.log("  ✗", u, atual[u].httpStatus ?? "sem resposta");
}
main().catch((e) => { console.error(e); process.exit(1); });
