import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffCtx as getCtx } from "@/lib/session";
import { aiAvailable, aiComplete } from "@/lib/ai";
import { conversar } from "@/lib/assistente/agente";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/audit";
import { creditosHoje, SemCreditos } from "@/lib/credits";
import { sessaoDoUsuario, criarSessao, anexar, mensagensDaSessao, contarMensagens, renomear, tituloDe, MAX_MSGS_POR_SESSAO } from "@/lib/assistente/sessoes";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ message: z.string().trim().min(1).max(4000), sessionId: z.string().optional() });

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const antes = await creditosHoje(ctx.user.id);
  if (antes.restantes <= 0) return NextResponse.json({ erro: new SemCreditos().message, creditos: antes }, { status: 402 });
  if (!aiAvailable()) return NextResponse.json({ erro: "O assistente ainda não foi ativado nesta instalação (falta configurar a chave de IA)." }, { status: 503 });
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ erro: "Mensagem inválida." }, { status: 400 });
  if (!(await rateLimit(`assistente:${ctx.user.id}`, 30, 3600))) return NextResponse.json({ erro: "Muitas mensagens em pouco tempo. Tente de novo em alguns minutos." }, { status: 429 });
  // sessão: usa a informada (só se for do professor) ou abre uma nova com o título da primeira mensagem
  let sessao = p.data.sessionId ? await sessaoDoUsuario(ctx.user.id, p.data.sessionId) : null;
  if (p.data.sessionId && !sessao) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  if (!sessao) sessao = await criarSessao(ctx.user.id, ctx.org.id, tituloDe(p.data.message));
  else if (sessao.title === "Nova conversa" && (await contarMensagens(sessao.id)) === 0) await renomear(ctx.user.id, sessao.id, tituloDe(p.data.message));
  if ((await contarMensagens(sessao.id)) >= MAX_MSGS_POR_SESSAO) return NextResponse.json({ erro: "Esta conversa ficou longa demais. Abra uma nova conversa para continuar.", sessionId: sessao.id }, { status: 409 });
  const historico = (await mensagensDaSessao(sessao.id)).filter((m) => !m.isError).map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  await anexar(sessao.id, { role: "user", content: p.data.message });
  const titulo = (await sessaoDoUsuario(ctx.user.id, sessao.id))?.title ?? sessao.title;
  try {
    const r = await conversar(ctx, [...historico, { role: "user", content: p.data.message }], (s, t) => aiComplete(s, t, 2500, 100_000));
    await anexar(sessao.id, { role: "assistant", content: r.texto, links: r.links });
    await track("assistant_message", ctx.user.id, ctx.org.id, { passos: r.passos.length });
    return NextResponse.json({ ...r, sessionId: sessao.id, titulo, creditos: await creditosHoje(ctx.user.id) });
  } catch (e) {
    const semCred = e instanceof SemCreditos;
    const erro = semCred ? e.message : "O assistente demorou ou falhou. Tente de novo.";
    await anexar(sessao.id, { role: "assistant", content: erro, isError: true });
    return NextResponse.json({ erro, sessionId: sessao.id, titulo, creditos: await creditosHoje(ctx.user.id) }, { status: semCred ? 402 : 502 });
  }
}
