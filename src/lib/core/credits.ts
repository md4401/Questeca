/** Créditos de IA: 1 crédito = 1.000 tokens (entrada + saída). */
export const TOKENS_POR_CREDITO = 1000;
export const creditsOf = (tokens: number) => tokens / TOKENS_POR_CREDITO;
/** Estimativa quando o provedor não informa o uso: ~3,3 caracteres por token em português. */
export const estimateTokens = (chars: number) => Math.ceil(chars / 3.3);
export const fmtCredits = (c: number) => (Math.round(c * 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
