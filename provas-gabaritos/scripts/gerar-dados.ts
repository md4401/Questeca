/** Regenera src/lib/dados.ts a partir de data/instituicoes.json (um import por instituição). Uso: pnpm tsx scripts/gerar-dados.ts */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const inst = JSON.parse(readFileSync("data/instituicoes.json", "utf8")) as { slug: string }[];
for (const i of inst) if (!existsSync(`data/edicoes/${i.slug}.json`)) writeFileSync(`data/edicoes/${i.slug}.json`, "[]\n");
const id = (s: string) => s.replace(/-/g, "_");
const out = `// Gerado por scripts/gerar-dados.ts — não edite à mão. Um arquivo de edições por instituição.
import instituicoes from "../../data/instituicoes.json";
import verificacao from "../../data/verificacao.json";
${inst.map((i) => `import e_${id(i.slug)} from "../../data/edicoes/${i.slug}.json";`).join("\n")}

export const INSTITUICOES_BRUTAS: unknown = instituicoes;
export const VERIFICACAO_BRUTA: unknown = verificacao;
export const EDICOES_BRUTAS: Record<string, unknown> = {
${inst.map((i) => `  "${i.slug}": e_${id(i.slug)}`).join(",\n")},
};
`;
writeFileSync("src/lib/dados.ts", out);
console.log(`dados.ts gerado com ${inst.length} instituições`);
