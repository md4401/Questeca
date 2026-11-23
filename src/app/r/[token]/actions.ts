"use server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { digitalLinks, applications, responses, studentPresence } from "@/db/schema";
import { applicationKey } from "@/lib/correction";
import { scoreResponse } from "@/lib/core/answerkey";
import { rateLimit } from "@/lib/ratelimit";
import { ip } from "@/lib/auth-core";
import type { FormState } from "@/components/form";

/** Envio único: valida o link (existência, validade, não enviado) e grava respostas já corrigidas. */
export async function submitDigitalAction(token: string, _: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit(`digital:${await ip()}`, 60, 600))) return { error: "Muitas tentativas. Aguarde um momento." };
  const [link] = await db.select().from(digitalLinks).where(eq(digitalLinks.token, token)).limit(1);
  if (!link) return { error: "Link inválido." };
  if (link.submittedAt) return { error: "As respostas deste link já foram enviadas." };
  if (link.expiresAt < new Date()) return { error: "O prazo deste link terminou. Fale com seu professor." };
  const [app] = await db.select().from(applications).where(eq(applications.id, link.applicationId)).limit(1);
  if (!app) return { error: "Avaliação indisponível." };
  const key = await applicationKey(app);
  const rows = key.items.map((it) => {
    const raw = String(fd.get(`q${it.position}`) ?? "").toUpperCase();
    const value = /^[A-E]$/.test(raw) ? raw : "-";
    const sc = scoreResponse({ key: it.key, points: it.points, value, status: "answered" });
    return { applicationId: app.id, studentId: link.studentId, position: it.position, value, status: sc.status, points: sc.points == null ? null : String(sc.points) };
  });
  // marca o envio primeiro (condição de corrida: só um envio vence)
  const done = await db.update(digitalLinks).set({ submittedAt: new Date() }).where(and(eq(digitalLinks.id, link.id), eq(digitalLinks.token, token))).returning({ id: digitalLinks.id });
  if (!done.length) return { error: "Não foi possível enviar." };
  await Promise.all(rows.map((r) => db.insert(responses).values(r).onConflictDoUpdate({ target: [responses.applicationId, responses.studentId, responses.position], set: { value: r.value, status: r.status, points: r.points } })));
  await db.delete(studentPresence).where(and(eq(studentPresence.applicationId, app.id), eq(studentPresence.studentId, link.studentId)));
  return { ok: "Respostas enviadas. Você já pode fechar esta página." };
}
