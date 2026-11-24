/** Ordem embaralhada que nunca é igual à original (para n ≥ 2): a versão B tem as mesmas questões em outra ordem. */
export function ordemEmbaralhada<T>(itens: T[], rand: () => number = Math.random): T[] {
  if (itens.length < 2) return [...itens];
  for (let t = 0; t < 20; t++) {
    const a = [...itens];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    if (a.some((x, i) => x !== itens[i])) return a;
  }
  return [...itens.slice(1), itens[0]]; // garantido diferente
}
