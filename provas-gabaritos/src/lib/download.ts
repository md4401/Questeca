import type { Edicao } from "@/lib/tipos";
/** Resolve /baixar/<id-da-edição>/<n> para a URL oficial. Só devolve endereços do catálogo, nunca um valor vindo do visitante. */
export function resolverDownload(lista: Edicao[], id: string, n: string): string | null {
  if (!/^\d{1,3}$/.test(n)) return null;
  const e = lista.find((x) => x.id === id);
  const a = e?.arquivos[Number(n)];
  return a && /^https?:\/\//i.test(a.url) ? a.url : null;
}
export const linkDownload = (e: Edicao, n: number) => `/baixar/${e.id}/${n}`;
