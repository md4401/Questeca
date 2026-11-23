import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { taskAttachments, messages, conversationMembers } from "@/db/schema";
import { getStaffCtx as getCtx } from "@/lib/session";

export const dynamic = "force-dynamic";
const NF = () => new NextResponse("Não encontrado", { status: 404 });

/** Anexo de mensagem: só quem é membro da conversa. Tipos seguros, sem execução no navegador. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NF();
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Entre para continuar", { status: 401 });
  const [a] = await db.select().from(taskAttachments).where(eq(taskAttachments.id, id)).limit(1);
  if (!a || a.orgId !== ctx.org.id || !a.messageId) return NF();
  const [m] = await db.select().from(messages).where(eq(messages.id, a.messageId)).limit(1);
  if (!m || m.deletedAt) return NF();
  const [mem] = await db.select().from(conversationMembers).where(and(eq(conversationMembers.conversationId, m.conversationId), eq(conversationMembers.userId, ctx.user.id))).limit(1);
  if (!mem) return NF();
  return new NextResponse(new Uint8Array(a.data), { headers: { "Content-Type": a.type, "Content-Disposition": `${a.type.startsWith("image/") || a.type.startsWith("audio/") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(a.name)}`, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox", "Cache-Control": "private, no-store" } });
}
