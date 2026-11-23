import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { getStaffCtx as getCtx } from "@/lib/session";

export const runtime = "nodejs";

/** Anexos seguem o público da publicação: de uma escola, só membros dessa escola abrem (SA-08). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [p] = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  if (!p || p.hidden || !p.attachment) return new NextResponse("Não encontrado", { status: 404 });
  if (p.orgId && !ctx.orgs.some((o) => o.id === p.orgId)) return new NextResponse("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(p.attachment), { headers: { "Content-Type": p.attachmentType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${encodeURIComponent(p.attachmentName ?? "anexo")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
