import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userAvatars, memberships } from "@/db/schema";
import { getCtx } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Foto de perfil: o próprio usuário ou a equipe da mesma escola. Aluno e responsável só veem a própria. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const portal = ctx.org.role === "student" || ctx.org.role === "guardian";
  if (id !== ctx.user.id) {
    if (portal) return new NextResponse("Não encontrado", { status: 404 });
    const [m] = await db.select().from(memberships).where(and(eq(memberships.userId, id), eq(memberships.orgId, ctx.org.id), eq(memberships.status, "active"))).limit(1);
    if (!m) return new NextResponse("Não encontrado", { status: 404 });
  }
  const [a] = await db.select().from(userAvatars).where(eq(userAvatars.userId, id)).limit(1);
  if (!a) return new NextResponse("Não encontrado", { status: 404 });
  return new NextResponse(new Uint8Array(a.data), { headers: { "Content-Type": a.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300", "Content-Security-Policy": "default-src 'none'" } });
}
