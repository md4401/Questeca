/** Sorteios da turma (puros e com gerador injetável, para testar). */
export function embaralhar<T>(xs: T[], rand: () => number = Math.random): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
/** Divide em `n` grupos o mais equilibrados possível (tamanhos diferem em no máximo 1). */
export function grupos<T>(xs: T[], n: number, rand?: () => number): T[][] {
  const k = Math.max(1, Math.min(n, xs.length || 1)); const out: T[][] = Array.from({ length: k }, () => []);
  embaralhar(xs, rand).forEach((x, i) => out[i % k].push(x));
  return out;
}
export const gruposPorTamanho = <T,>(xs: T[], tamanho: number, rand?: () => number) => grupos(xs, Math.max(1, Math.ceil(xs.length / Math.max(1, tamanho))), rand);
