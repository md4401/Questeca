import { NextResponse } from "next/server";
import { getStaffCtx as getCtx } from "@/lib/session";
import { listarSessoes, criarSessao } from "@/lib/assistente/sessoes";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  return NextResponse.json({ sessoes: await listarSessoes(ctx.user.id) });
}

export async function POST() {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const s = await criarSessao(ctx.user.id, ctx.org.id);
  return NextResponse.json({ id: s.id, title: s.title, updatedAt: s.updatedAt }, { status: 201 });
}
