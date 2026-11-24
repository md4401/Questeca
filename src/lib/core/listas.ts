/** Reparte itens entre as versões A e B (alternando, para as duas ficarem com dificuldade parecida). */
export function dividirAB<T>(itens: T[]): { a: T[]; b: T[] } {
  return { a: itens.filter((_, i) => i % 2 === 0), b: itens.filter((_, i) => i % 2 === 1) };
}
