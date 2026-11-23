import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { answerSheets } from "@/db/schema";
import { getCtx } from "@/lib/session";
import { loadApplication } from "@/lib/access";

export const runtime = "nodejs";

/** Imagens de cartões são privadas: exigem sessão e acesso à turma da aplicação. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrado", { status: 404 });
  const [s] = await db.select().from(answerSheets).where(eq(answerSheets.id, id)).limit(1);
  if (!s?.image) return new NextResponse("Não encontrado", { status: 404 });
  try { await loadApplication(ctx, s.applicationId); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  return new Response(new Uint8Array(s.image), { headers: { "Content-Type": s.contentType ?? "image/jpeg", "Cache-Control": "private, no-store" } });
}
