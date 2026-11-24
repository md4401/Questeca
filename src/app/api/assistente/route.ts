import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffCtx as getCtx } from "@/lib/session";
import { aiAvailable, aiComplete } from "@/lib/ai";
import { conversar } from "@/lib/assistente/agente";
import { rateLimit } from "@/lib/ratelimit";
import { track } from "@/lib/audit";
import { creditosHoje, SemCreditos } from "@/lib/credits";
import { sessaoDoUsuario, criarSessao, anexar, apagarAPartirDe, mensagensDaSessao, contarMensagens, renomear, tituloDe, MAX_MSGS_POR_SESSAO, type Anexo } from "@/lib/assistente/sessoes";
import { extractTextFromFile } from "@/lib/materials";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ message: z.string().trim().max(4000).default(""), sessionId: z.string().optional(), editarId: z.string().optional() });
const MAX_ARQUIVOS = 3;
const TEXTO_POR_ARQUIVO = 12_000;

export async function POST(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  const antes = await creditosHoje(ctx.user.id);
  if (antes.restantes <= 0) return NextResponse.json({ erro: new SemCreditos().message, creditos: antes }, { status: 402 });
  if (!aiAvailable()) return NextResponse.json({ erro: "A GizIA ainda não foi ativada nesta instalação (falta configurar a chave de IA)." }, { status: 503 });
  // JSON (só texto) ou multipart (texto + arquivos)
  let corpo: unknown; let arquivos: File[] = [];
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData().catch(() => null);
    if (!fd) return NextResponse.json({ erro: "Não consegui ler o envio." }, { status: 400 });
    corpo = { message: String(fd.get("message") ?? ""), sessionId: fd.get("sessionId") ? String(fd.get("sessionId")) : undefined, editarId: fd.get("editarId") ? String(fd.get("editarId")) : undefined };
    arquivos = fd.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  } else corpo = await req.json().catch(() => null);
  const p = Body.safeParse(corpo);
  if (!p.success) return NextResponse.json({ erro: "Mensagem inválida." }, { status: 400 });
  if (!p.data.message && arquivos.length === 0) return NextResponse.json({ erro: "Escreva uma mensagem ou anexe um arquivo." }, { status: 400 });
  if (arquivos.length > MAX_ARQUIVOS) return NextResponse.json({ erro: `Envie no máximo ${MAX_ARQUIVOS} arquivos por mensagem.` }, { status: 400 });
  if (!(await rateLimit(`assistente:${ctx.user.id}`, 30, 3600))) return NextResponse.json({ erro: "Muitas mensagens em pouco tempo. Tente de novo em alguns minutos." }, { status: 429 });
  // lê os arquivos (PDF, DOCX, TXT/MD e fotos) e guarda só o texto extraído
  const anexos: Anexo[] = [];
  for (const f of arquivos) {
    const r = await extractTextFromFile(f);
    if ("error" in r) return NextResponse.json({ erro: `${f.name}: ${r.error}` }, { status: 400 });
    anexos.push({ name: f.name.slice(0, 120), mime: f.type || "application/octet-stream", size: f.size, text: r.text.slice(0, TEXTO_POR_ARQUIVO) });
  }
  const mensagem = p.data.message || "Estou enviando um arquivo.";

  // sessão: usa a informada (só se for do professor) ou abre uma nova com o título da primeira mensagem
  let sessao = p.data.sessionId ? await sessaoDoUsuario(ctx.user.id, p.data.sessionId) : null;
  if (p.data.sessionId && !sessao) return NextResponse.json({ erro: "Conversa não encontrada." }, { status: 404 });
  // editar uma mensagem: apaga ela e tudo depois, e a conversa recomeça dali
  if (p.data.editarId) {
    const apagada = sessao ? await apagarAPartirDe(sessao.id, p.data.editarId) : null;
    if (!sessao || !apagada) return NextResponse.json({ erro: "Não foi possível editar essa mensagem." }, { status: 404 });
    if (anexos.length === 0) anexos.push(...apagada.anexos); // sem novos arquivos, a mensagem editada mantém os anexos que já tinha
    if ((await contarMensagens(sessao.id)) === 0) await renomear(ctx.user.id, sessao.id, tituloDe(mensagem));
  }
  if (!sessao) sessao = await criarSessao(ctx.user.id, ctx.org.id, tituloDe(mensagem));
  else if (sessao.title === "Nova conversa" && (await contarMensagens(sessao.id)) === 0) await renomear(ctx.user.id, sessao.id, tituloDe(mensagem));
  if ((await contarMensagens(sessao.id)) >= MAX_MSGS_POR_SESSAO) return NextResponse.json({ erro: "Esta conversa ficou longa demais. Abra uma nova conversa para continuar.", sessionId: sessao.id }, { status: 409 });
  const historico = (await mensagensDaSessao(sessao.id)).filter((m) => !m.isError).map((m) => ({ role: m.role as "user" | "assistant", content: m.content, anexos: m.attachments.map((a) => ({ name: a.name, text: a.text })) }));
  const usuarioId = await anexar(sessao.id, { role: "user", content: mensagem, attachments: anexos });
  const titulo = (await sessaoDoUsuario(ctx.user.id, sessao.id))?.title ?? sessao.title;
  const tela = anexos.map(({ name, mime, size }) => ({ name, mime, size }));
  try {
    const r = await conversar(ctx, [...historico, { role: "user", content: mensagem, anexos: anexos.map((a) => ({ name: a.name, text: a.text })) }], (s, t, sig) => aiComplete(s, t, 2500, 100_000, sig), { signal: req.signal });
    const assistenteId = await anexar(sessao.id, { role: "assistant", content: r.texto, links: r.links });
    await track("assistant_message", ctx.user.id, ctx.org.id, { passos: r.passos.length, anexos: anexos.length });
    return NextResponse.json({ ...r, sessionId: sessao.id, titulo, usuarioId, assistenteId, anexos: tela, creditos: await creditosHoje(ctx.user.id) });
  } catch (e) {
    // o professor apertou "Parar": não grava resposta nenhuma
    if (req.signal.aborted || (e instanceof Error && e.name === "AbortError")) return NextResponse.json({ interrompido: true, sessionId: sessao.id, usuarioId, titulo }, { status: 499 });
    const semCred = e instanceof SemCreditos;
    const erro = semCred ? e.message : "A GizIA demorou ou falhou. Tente de novo.";
    await anexar(sessao.id, { role: "assistant", content: erro, isError: true });
    return NextResponse.json({ erro, sessionId: sessao.id, titulo, usuarioId, anexos: tela, creditos: await creditosHoje(ctx.user.id) }, { status: semCred ? 402 : 502 });
  }
}
