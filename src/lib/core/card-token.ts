import { createHmac, timingSafeEqual } from "node:crypto";
/** Token assinado do QR do cartão: liga aplicação + aluno. Não concede acesso sozinho; quem abre precisa estar autenticado e autorizado na turma. */
const b = (s: string) => Buffer.from(s, "base64url");
export function signCard(appId: string, studentId: string, secret: string) {
  const payload = `${appId}.${studentId}`;
  const mac = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 16);
  return `${Buffer.from(payload).toString("base64url")}.${mac}`;
}
export function verifyCard(token: string, secret: string): { appId: string; studentId: string } | null {
  const [p, mac] = token.split(".");
  if (!p || !mac) return null;
  const payload = b(p).toString();
  const [appId, studentId] = payload.split(".");
  if (!/^[0-9a-f-]{36}$/i.test(appId ?? "") || !/^[0-9a-f-]{36}$/i.test(studentId ?? "")) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url").slice(0, 16);
  const a = Buffer.from(mac), e = Buffer.from(expected);
  return a.length === e.length && timingSafeEqual(a, e) ? { appId, studentId } : null;
}
