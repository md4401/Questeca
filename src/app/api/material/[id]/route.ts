import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { materials } from "@/db/schema";
import { getCtx } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [m] = await db.select().from(materials).where(and(eq(materials.id, id), eq(materials.ownerId, ctx.user.id))).limit(1);
  if (!m?.file) return new NextResponse("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(m.file), { headers: { "Content-Type": m.fileType ?? "application/octet-stream", "Content-Disposition": `attachment; filename="${encodeURIComponent(m.fileName ?? "material")}"`, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" } });
}
