import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffCtx as getCtx } from "@/lib/session";
import { aiAvailable, aiComplete } from "@/lib/ai";
import { conversar } from "@/lib/assistente/agente";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/audit";
import { creditosHoje, SemCreditos } from "@/lib/credits";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(40) });

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const antes = await creditosHoje(ctx.user.id);
  if (antes.restantes <= 0) return NextResponse.json({ erro: new SemCreditos().message, creditos: antes }, { status: 402 });
  if (!aiAvailable()) return NextResponse.json({ erro: "O assistente ainda não foi ativado nesta instalação (falta configurar a chave de IA)." }, { status: 503 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success || p.data.messages[p.data.messages.length - 1].role !== "user") return NextResponse.json({ erro: "Mensagem inválida." }, { status: 400 });
  if (!(await rateLimit(`assistente:${ctx.user.id}`, 30, 3600))) return NextResponse.json({ erro: "Muitas mensagens em pouco tempo. Tente de novo em alguns minutos." }, { status: 429 });
  try {
    const r = await conversar(ctx, p.data.messages, (s, t) => aiComplete(s, t, 2500, 100_000));
    await track("assistant_message", ctx.user.id, ctx.org.id, { passos: r.passos.length });
    return NextResponse.json({ ...r, creditos: await creditosHoje(ctx.user.id) });
  } catch (e) {
    if (e instanceof SemCreditos) return NextResponse.json({ erro: e.message, creditos: await creditosHoje(ctx.user.id) }, { status: 402 });
    return NextResponse.json({ erro: "O assistente demorou ou falhou. Tente de novo." }, { status: 502 });
  }
}
