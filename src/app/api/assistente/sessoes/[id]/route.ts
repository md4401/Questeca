import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffCtx as getCtx } from "@/lib/session";
import { sessaoDoUsuario, mensagensDaSessao, renomear, apagar } from "@/lib/assistente/sessoes";

export const runtime = "nodejs";
type P = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: P) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const s = await sessaoDoUsuario(ctx.user.id, (await params).id);
  if (!s) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ id: s.id, title: s.title, mensagens: await mensagensDaSessao(s.id) });
}

export async function PATCH(req: Request, { params }: P) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const b = z.object({ titulo: z.string().trim().min(1).max(80) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return NextResponse.json({ erro: "Dê um nome de até 80 caracteres." }, { status: 400 });
  const id = (await params).id;
  if (!(await sessaoDoUsuario(ctx.user.id, id)) || !(await renomear(ctx.user.id, id, b.data.titulo))) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: P) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const id = (await params).id;
  if (!(await sessaoDoUsuario(ctx.user.id, id)) || !(await apagar(ctx.user.id, id))) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
