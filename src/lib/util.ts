/** Lista não vazia para `inArray` (uma lista vazia gera SQL inválido). */
export const anyOf = (ids: string[]) => (ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
