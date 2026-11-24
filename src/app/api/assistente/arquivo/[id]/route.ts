import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { assistantFiles } from "@/db/schema";
import { getStaffCtx as getCtx } from "@/lib/session";
import { renderDeck } from "@/lib/assistente/pptx";
import { slug } from "@/lib/export-helpers";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [f] = await db.select().from(assistantFiles).where(and(eq(assistantFiles.id, id), eq(assistantFiles.ownerId, ctx.user.id))).limit(1);
  if (!f) return new NextResponse("Não encontrado", { status: 404 });
  const buf = await renderDeck({ titulo: f.title, subtitulo: f.data.subtitulo, slides: f.data.slides });
  return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "Content-Disposition": `attachment; filename="${slug(f.title)}.pptx"`, "Cache-Control": "private, no-store" } });
}
