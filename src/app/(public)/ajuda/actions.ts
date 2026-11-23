"use server";
import { z } from "zod";
import { db } from "@/db";
import { tickets, demoRequests } from "@/db/schema";
import { getCtx } from "@/lib/session";
import { rateLimit } from "@/lib/ratelimit";
import { ip } from "@/lib/auth-core";
import type { FormState } from "@/components/form";

export async function contactAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await getCtx();
  if (!(await rateLimit(`contact:${ctx?.user.id ?? (await ip())}`, 6, 3600))) return { error: "Muitos envios. Tente mais tarde." };
  const base = z.object({ subject: z.string().trim().min(3, "Informe o assunto."), body: z.string().trim().min(5, "Escreva a mensagem.").max(5000), recordRef: z.string().trim().max(120).optional() });
  const p = base.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  if (ctx) {
    await db.insert(tickets).values({ userId: ctx.user.id, orgId: ctx.org.id, subject: p.data.subject, body: p.data.body, recordRef: p.data.recordRef });
  } else {
    const a = z.object({ name: z.string().trim().min(2), email: z.string().trim().email() }).safeParse(Object.fromEntries(fd));
    if (!a.success) return { error: "Informe nome e e-mail válidos." };
    await db.insert(demoRequests).values({ name: a.data.name, email: a.data.email, school: "(contato geral)", message: `${p.data.subject}\n\n${p.data.body}` });
  }
  return { ok: "Mensagem enviada. Responderemos por e-mail." };
}
