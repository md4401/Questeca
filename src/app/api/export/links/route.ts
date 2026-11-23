import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { digitalLinks, students } from "@/db/schema";
import { getStaffCtx as getCtx } from "@/lib/session";
import { loadApplication } from "@/lib/access";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const appId = new URL(req.url).searchParams.get("app") ?? "";
  try { await loadApplication(ctx, appId); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  const rows = await db.select({ name: students.name, reg: students.registration, token: digitalLinks.token, exp: digitalLinks.expiresAt, sub: digitalLinks.submittedAt }).from(digitalLinks).innerJoin(students, eq(students.id, digitalLinks.studentId)).where(eq(digitalLinks.applicationId, appId));
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = ["Matrícula;Aluno;Link;Validade;Enviado", ...rows.map((r) => [r.reg ?? "", r.name, `${env.appUrl()}/r/${r.token}`, r.exp.toISOString(), r.sub ? "sim" : "não"].map(esc).join(";"))];
  return new Response("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="links-aplicacao-digital.csv"', "Cache-Control": "private, no-store" } });
}
