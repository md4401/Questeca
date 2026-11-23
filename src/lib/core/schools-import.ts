/** Leitura do Censo Escolar (Inep) para o catálogo de escolas. Funções puras, testáveis sem o arquivo real. */
import { normalize } from "@/lib/taxonomy";

const LOWER = new Set(["de", "da", "do", "das", "dos", "e", "a", "o", "em", "na", "no", "para", "com"]);
const ACRONYMS = new Set(["emef", "emei", "emeief", "emefm", "eefm", "eeefm", "eefmti", "ee", "em", "ef", "ei", "ce", "cef", "cei", "cemei", "ceu", "ciep", "etec", "fatec", "sesi", "senai", "senac", "if", "ifsp", "ifpr", "ifmg", "ufsc", "ufmg", "usp", "ue", "ec", "ie", "cmei", "cmef", "cmeb", "emeb", "emeif", "eeb", "eeef", "eem", "eemti", "cetec", "ceja", "eja", "cp", "cpii", "ii", "iii", "iv", "vi", "vii", "viii", "ix", "xi", "xii", "xiii", "xv", "xx", "xxi", "xxiii", "cnec", "apae", "ltda", "me", "epp", "s/a"]);

/** "COLEGIO SAO JOAO BATISTA" → "Colegio Sao Joao Batista" (sem inventar acentos que o Inep não traz). */
export function titleCase(s: string): string {
  return s.toLocaleLowerCase("pt-BR").split(/(\s+|-|\/)/).map((w, i) => {
    if (!w.trim() || /^(-|\/)$/.test(w)) return w;
    if (i > 0 && LOWER.has(w)) return w;
    if (ACRONYMS.has(w)) return w.toUpperCase();
    return w.charAt(0).toLocaleUpperCase("pt-BR") + w.slice(1);
  }).join("");
}

export const DEPENDENCIA: Record<string, string> = { "1": "Federal", "2": "Estadual", "3": "Municipal", "4": "Privada" };
export const REQUIRED = ["CO_ENTIDADE", "NO_ENTIDADE", "SG_UF", "NO_MUNICIPIO"] as const;

export type SchoolRow = { inepCode: string; name: string; nameNorm: string; city: string; cityNorm: string; uf: string; neighborhood: string | null; dependency: string | null };

export function missingColumns(headers: string[]) { return REQUIRED.filter((c) => !headers.includes(c)); }

/** Converte uma linha do CSV em registro, ou null se a escola não deve entrar (inativa, fora do EF/EM, dado inválido). */
export function toSchool(r: Record<string, string>): SchoolRow | null {
  const code = (r.CO_ENTIDADE ?? "").trim();
  if (!/^\d{6,10}$/.test(code)) return null;
  // 1 = em atividade (se a coluna existir)
  if ("TP_SITUACAO_FUNCIONAMENTO" in r && r.TP_SITUACAO_FUNCIONAMENTO.trim() !== "1") return null;
  // só quem tem anos finais do fundamental ou ensino médio (se as colunas existirem)
  const hasLevel = "IN_FUND_AF" in r || "IN_MED" in r;
  if (hasLevel && r.IN_FUND_AF?.trim() !== "1" && r.IN_MED?.trim() !== "1") return null;
  const name = titleCase((r.NO_ENTIDADE ?? "").trim().replace(/\s+/g, " "));
  const city = titleCase((r.NO_MUNICIPIO ?? "").trim());
  const uf = (r.SG_UF ?? "").trim().toUpperCase();
  if (name.length < 3 || !city || !/^[A-Z]{2}$/.test(uf)) return null;
  const nb = (r.NO_BAIRRO ?? "").trim();
  return { inepCode: code, name, nameNorm: normalize(name), city, cityNorm: normalize(city), uf, neighborhood: nb ? titleCase(nb) : null, dependency: DEPENDENCIA[(r.TP_DEPENDENCIA ?? "").trim()] ?? null };
}
