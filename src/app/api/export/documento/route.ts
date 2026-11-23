import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getStaffCtx as getCtx } from "@/lib/session";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { renderTextDocument } from "@/lib/pdf-text";
import { pdfResponse, slug } from "@/lib/export-helpers";
import { can } from "@/lib/core/permissions";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id))).limit(1);
  if (!d || (d.authorId !== ctx.user.id && !can(ctx.org.role, "doc.review"))) return new NextResponse("Não encontrado", { status: 404 });
  if (d.status !== "approved") return new NextResponse("O PDF final só é gerado após a aprovação.", { status: 409 });
  const bytes = await renderTextDocument({ school: ctx.org.settings.header?.schoolName ?? ctx.org.name, title: d.title, body: d.body, footer: `Versão ${d.version} · documento aprovado` });
  return pdfResponse(bytes, `${slug(d.title)}.pdf`);
}
