"use server";
import { z } from "zod";
import { db } from "@/db";
import { demoRequests } from "@/db/schema";
import { rateLimit } from "@/lib/ratelimit";
import { ip } from "@/lib/auth-core";
import { sendMail } from "@/lib/email";
import type { FormState } from "@/components/form";

export async function demoRequestAction(_: FormState, fd: FormData): Promise<FormState> {
  const p = z.object({ name: z.string().trim().min(2), email: z.string().trim().email(), school: z.string().trim().min(2), message: z.string().trim().max(2000).optional() }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Preencha nome, e-mail válido e escola." };
  if (!(await rateLimit(`demo:${await ip()}`, 5, 3600))) return { error: "Muitos envios. Tente mais tarde." };
  await db.insert(demoRequests).values(p.data);
  if (process.env.SUPPORT_EMAIL) await sendMail({ to: process.env.SUPPORT_EMAIL, subject: `Demonstração: ${p.data.school}`, html: `<p>${p.data.name} (${p.data.email}) — ${p.data.school}</p><p>${p.data.message ?? ""}</p>` });
  return { ok: "Recebemos seu pedido. Entraremos em contato por e-mail." };
}
