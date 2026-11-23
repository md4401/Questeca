/** Regras de comunicação (puras). Aluno nunca fala com adulto sem política explícita da escola; portal↔portal nunca. */
export type ChatRole = "admin" | "coordinator" | "teacher" | "student" | "guardian";
export type Policy = { studentToStaff: boolean; guardianToStaff: boolean; classGroups: boolean; hoursFrom: string | null; hoursTo: string | null };
export const isStaff = (r: ChatRole) => r === "admin" || r === "coordinator" || r === "teacher";

export function policyFrom(c?: { studentToStaff?: boolean; guardianToStaff?: boolean; classGroups?: boolean; hoursFrom?: string; hoursTo?: string }): Policy {
  return { studentToStaff: c?.studentToStaff ?? false, guardianToStaff: c?.guardianToStaff ?? true, classGroups: c?.classGroups ?? false, hoursFrom: c?.hoursFrom || null, hoursTo: c?.hoursTo || null };
}

export type Verdict = { ok: true } | { ok: false; reason: string };
/** Pode `sender` abrir conversa direta com `recipient`? `sharedClass`: estão ligados por uma turma (ou o remetente é coordenação). */
export function canStart(sender: ChatRole, recipient: ChatRole, sharedClass: boolean, p: Policy): Verdict {
  if (isStaff(sender) && isStaff(recipient)) return { ok: true };
  if (!isStaff(sender) && !isStaff(recipient)) return { ok: false, reason: "Alunos e responsáveis não conversam entre si pela plataforma." };
  if (!sharedClass) return { ok: false, reason: "Você só conversa com quem está ligado às turmas do estudante." };
  if (isStaff(sender)) return { ok: true };
  if (sender === "guardian") return p.guardianToStaff ? { ok: true } : { ok: false, reason: "A escola não habilitou mensagens de responsáveis." };
  return p.studentToStaff ? { ok: true } : { ok: false, reason: "A escola não habilitou mensagens diretas de alunos." };
}

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
/** Horário de atendimento (fuso de São Paulo). Vale só para quem não é equipe; sem janela configurada, sempre aberto. */
export function withinHours(now: Date, p: Policy): boolean {
  if (!p.hoursFrom || !p.hoursTo) return true;
  const sp = new Date(now.getTime() - 3 * 3600e3);
  const cur = sp.getUTCHours() * 60 + sp.getUTCMinutes();
  return cur >= mins(p.hoursFrom) && cur < mins(p.hoursTo);
}

export function canPostInGroup(role: ChatRole, kind: string, p: Policy): Verdict {
  if (isStaff(role)) return { ok: true };
  if (kind === "class" && p.classGroups) return { ok: true };
  return { ok: false, reason: "A escola não habilitou conversas em grupo para alunos e responsáveis." };
}

export const directKey = (a: string, b: string) => [a, b].sort().join(":");

const SAFE = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "audio/mpeg", "audio/ogg", "audio/webm", "audio/mp4", "text/plain"]);
export const MAX_ATTACH = 2 * 1024 * 1024;
/** Anexos de mensagem: só tipos que o navegador não executa (nada de HTML/SVG). */
export function attachmentProblem(type: string, size: number): string | null {
  if (!SAFE.has(type)) return "Tipo de arquivo não permitido. Use imagem (PNG, JPG, WebP, GIF), PDF, áudio ou texto.";
  if (size > MAX_ATTACH) return "O anexo passa de 2 MB.";
  return null;
}
export const EDIT_WINDOW_MIN = 15;
export const canEdit = (createdAt: Date, now: Date) => now.getTime() - createdAt.getTime() <= EDIT_WINDOW_MIN * 60e3;
export const REACTIONS = ["👍", "❤️", "👏", "✅"] as const;

/** Link de vídeo → URL de incorporação segura (YouTube sem cookies ou Vimeo). Outros links só abrem em nova aba. */
export function embedUrl(raw: string): string | null {
  let u: URL; try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const h = u.hostname.replace(/^www\./, "");
  let id: string | null = null;
  if (h === "youtu.be") id = u.pathname.slice(1);
  else if (h === "youtube.com" || h === "m.youtube.com") id = u.pathname === "/watch" ? u.searchParams.get("v") : u.pathname.startsWith("/embed/") ? u.pathname.split("/")[2] : null;
  if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;
  if (h === "vimeo.com") { const v = u.pathname.split("/").filter(Boolean)[0]; if (v && /^\d+$/.test(v)) return `https://player.vimeo.com/video/${v}`; }
  return null;
}
export const validHttpUrl = (s: string) => { try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };
