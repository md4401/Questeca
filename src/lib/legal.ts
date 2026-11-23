/** Dados do controlador, lidos do ambiente (defina no painel; nunca no código). */
export function legal() {
  return {
    nome: process.env.LEGAL_NAME || "[RAZÃO SOCIAL — defina LEGAL_NAME]",
    cnpj: process.env.LEGAL_CNPJ || "[CNPJ — defina LEGAL_CNPJ]",
    endereco: process.env.LEGAL_ADDRESS || "[ENDEREÇO — defina LEGAL_ADDRESS]",
    email: process.env.LEGAL_EMAIL || "[E-MAIL DO ENCARREGADO — defina LEGAL_EMAIL]",
    encarregado: process.env.LEGAL_DPO || "[NOME DO ENCARREGADO — defina LEGAL_DPO]",
    foro: process.env.LEGAL_FORUM || "[COMARCA — defina LEGAL_FORUM]",
  };
}
export const LEGAL_VERSION = "2026-11-23";
