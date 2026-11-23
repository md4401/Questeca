/** Aceita o link inteiro do QR, o caminho ou só o token. */
export const tokenFromScan = (raw: string) => (raw.trim().split("/g/").pop() ?? "").split(/[?#\s]/)[0];
