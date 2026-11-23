export const fmtNum = (n: number | string | null | undefined, digits = 2) =>
  n == null || n === "" ? "—" : Number(n).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: digits });
export const fmtDate = (d: Date | string | null | undefined) => {
  if (!d) return "—";
  const dt = typeof d === "string" ? new Date(d + (d.length === 10 ? "T12:00:00" : "")) : d;
  return dt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};
export const fmtDateTime = (d: Date | string) => new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
export const todayISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
export const STATUS_LABEL: Record<string, string> = {
  curation: "Em curadoria", reference_only: "Só referência", released: "Liberado", in_review: "Em revisão", blocked: "Bloqueado",
};
