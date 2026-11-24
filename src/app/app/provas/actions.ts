"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, asc, desc, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, assessmentItems, assessmentHistory, applications, lessonLogs, materials, questions, type Scope } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadAssessment, loadClass } from "@/lib/access";
import {
  loadPool, runSelection, explainReason, getItems, evenPoints, pushHistory, restoreHistory, lastHistory, renumber,
  conflictsFor, ensureVersion, toCandidate, usedQuestionIdsForClass, type QRow,
} from "@/lib/assessments";
import { consumeAssembly, planInfo } from "@/lib/billing";
import { selecionarPorTemas } from "@/lib/montar";
import { topicName } from "@/lib/taxonomy";
import { extractTextFromFile } from "@/lib/materials";
import { extractTopics, extractExclusions, TOPICS } from "@/lib/taxonomy";
import { checkIntegrity } from "@/lib/core/selection";
import { parseAnswerKey } from "@/lib/core/answerkey";
import { audit, track } from "@/lib/audit";
import { todayISO } from "@/lib/format";
import type { FormState } from "@/components/form";

const emptyScope = (): Scope => ({ willFall: [], prerequisite: [], notTaught: [], confirm: [], sources: {} });

/* ---------- 1) Rascunho a partir do que foi ensinado ---------- */
export async function createDraftAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const classId = String(fd.get("classId") ?? "") || null;
  if (classId) await loadClass(ctx, classId);
  const title = String(fd.get("title") ?? "").trim() || "Nova prova";
  let text = String(fd.get("text") ?? "").trim();
  const file = fd.get("file");
  let fileInfo: { name: string; type: string; buf: Buffer } | null = null;
  if (file instanceof File && file.size > 0) {
    const r = await extractTextFromFile(file);
    if ("error" in r) return { error: r.error };
    text = `${text}\n\n${r.text}`.trim();
    fileInfo = { name: file.name, type: file.type, buf: Buffer.from(await file.arrayBuffer()) };
  }
  const scope = emptyScope();
  if (text) {
    const excl = new Set(extractExclusions(text));
    for (const t of extractTopics(text)) {
      scope.sources![t.slug] = t.excerpt;
      if (excl.has(t.slug)) scope.notTaught.push(t.slug); else scope.willFall.push(t.slug);
    }
  }
  if (fd.get("useLog") === "on" && classId) {
    const logs = await db.select().from(lessonLogs).where(eq(lessonLogs.classId, classId)).orderBy(desc(lessonLogs.taughtOn)).limit(30);
    for (const l of logs) for (const s of l.topics) {
      if (!scope.willFall.includes(s) && !scope.prerequisite.includes(s) && !scope.notTaught.includes(s)) { scope.prerequisite.push(s); scope.sources![s] = `Diário de ${l.taughtOn}`; }
    }
  }
  const [a] = await db.insert(assessments).values({ orgId: ctx.org.id, classId, ownerId: ctx.user.id, title, scope }).returning();
  if (text && fileInfo) await db.insert(materials).values({ orgId: ctx.org.id, ownerId: ctx.user.id, classId, title: fileInfo.name, kind: "teoria", text, file: fileInfo.buf, fileName: fileInfo.name, fileType: fileInfo.type });
  else if (text.length > 40) await db.insert(materials).values({ orgId: ctx.org.id, ownerId: ctx.user.id, classId, title: `Texto — ${title}`, kind: "teoria", text });
  await audit(ctx.user.id, ctx.org.id, "assessment.draft_created", a.id);
  await track("draft_created", ctx.user.id, ctx.org.id, { assessmentId: a.id });
  redirect(`/app/provas/${a.id}/escopo`);
}

/* ---------- 2) Escopo → busca ---------- */
function readScope(fd: FormData): Scope {
  const s: Scope = emptyScope();
  for (const t of TOPICS) {
    const v = String(fd.get(`t_${t.slug}`) ?? "");
    if (v === "f") s.willFall.push(t.slug);
    else if (v === "p") s.prerequisite.push(t.slug);
    else if (v === "n") s.notTaught.push(t.slug);
    else if (v === "c") s.confirm.push(t.slug);
  }
  return s;
}

export async function saveScopeAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const p = z.object({
    title: z.string().trim().min(1).max(140),
    wantedCount: z.coerce.number().int().min(1, "Informe quantas questões deseja.").max(60),
    durationMin: z.coerce.number().int().min(5).max(600),
    totalPoints: z.string().transform((v) => Number(v.replace(",", "."))).pipe(z.number().positive().max(1000)),
    yearFrom: z.coerce.number().int().min(1990).max(2100).optional().or(z.literal("").transform(() => undefined)),
    yearTo: z.coerce.number().int().min(1990).max(2100).optional().or(z.literal("").transform(() => undefined)),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const scope = readScope(fd);
  scope.sources = a.scope.sources ?? {};
  if (!scope.willFall.length) return { error: "Marque ao menos um conteúdo em “Vai cair” para buscar questões." };
  const filters = {
    institutions: fd.getAll("inst").map(String).filter(Boolean),
    yearFrom: p.data.yearFrom, yearTo: p.data.yearTo,
    difficulty: fd.getAll("diff").map(Number).filter((n) => n >= 1 && n <= 5),
  };
  await pushHistory(id, "Antes de nova busca");
  const existing = await getItems(id);
  const keep = existing.filter((i) => i.item.pinned || i.item.manual);
  const keepIds = keep.map((k) => k.q.id);
  await db.update(assessments).set({ title: p.data.title, scope, wantedCount: p.data.wantedCount, durationMin: p.data.durationMin, totalPoints: String(p.data.totalPoints), filters, updatedAt: new Date() }).where(eq(assessments.id, id));

  const pool = await loadPool("matematica", ctx.org.id);
  const used = await usedQuestionIdsForClass(a.classId);
  const { result, byId } = runSelection(pool, scope, { wantedCount: p.data.wantedCount, durationMin: p.data.durationMin, filters }, used, keepIds);

  // Sem questões etiquetadas por conteúdo: pesquisa no banco pelo texto dos conteúdos marcados (acervo importado das provas).
  let fb: Awaited<ReturnType<typeof selecionarPorTemas>>["picked"] = [];
  if (!result.picks.length) {
    const cls = a.classId ? (await loadClass(ctx, a.classId)).cls : null;
    const temas = scope.willFall.map(topicName);
    fb = (await selecionarPorTemas({ orgId: ctx.org.id, temas, subject: "matematica", grade: cls?.grade ?? "9", count: p.data.wantedCount - keepIds.length, insts: filters.institutions, usedIds: [...used, ...keepIds] })).picked;
  }
  // Cota: conta na primeira gravação com ao menos um item elegível; sem consumo se nada for encontrado.
  if (result.picks.length > 0 || fb.length > 0) {
    const q = await consumeAssembly(ctx.org.id, id);
    if (!q.ok) {
      revalidatePath(`/app/provas/${id}`);
      return { error: `${q.reason} Você ainda pode montar manualmente pelo Banco de questões.` };
    }
  }

  const nonKeep = existing.filter((i) => !(i.item.pinned || i.item.manual));
  if (nonKeep.length) await db.delete(assessmentItems).where(inArray(assessmentItems.id, nonKeep.map((n) => n.item.id)));
  const picks = result.picks;
  const total = keep.length + picks.length + fb.length;
  const pts = evenPoints(p.data.totalPoints, total);
  let pos = keep.length;
  const keepRows = keep.sort((x, y) => x.item.position - y.item.position);
  for (let i = 0; i < keepRows.length; i++) await db.update(assessmentItems).set({ position: i + 1, points: String(pts[i]), scopeAck: false }).where(eq(assessmentItems.id, keepRows[i].item.id));
  if (picks.length) {
    await db.insert(assessmentItems).values(picks.map((pk, i) => ({
      assessmentId: id, questionId: pk.id, position: ++pos, points: String(pts[keep.length + i]),
      reason: explainReason(byId.get(pk.id)!, pk.matched),
    })));
  }
  if (fb.length) {
    await db.insert(assessmentItems).values(fb.map((f, i) => ({ assessmentId: id, questionId: f.q.id, position: keep.length + i + 1, points: String(pts[keep.length + i]), reason: `Encontrada pelo texto dos conteúdos. ${f.q.institution} ${f.q.year}.` })));
  }
  await audit(ctx.user.id, ctx.org.id, "assessment.searched", id, { found: result.found + fb.length, wanted: p.data.wantedCount });
  await track("search_done", ctx.user.id, ctx.org.id, { found: result.found, wanted: p.data.wantedCount });
  const qs = new URLSearchParams({ achou: String(result.found + fb.length), pedido: String(p.data.wantedCount) });
  if (result.uncovered.length) qs.set("faltam", result.uncovered.join(","));
  redirect(`/app/provas/${id}?${qs}`);
}

/* ---------- 3) Editor ---------- */
async function touch(id: string, label: string) {
  await pushHistory(id, label);
}

export async function pinAction(id: string, itemId: string, pinned: boolean) {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  await touch(id, pinned ? "Fixar item" : "Desafixar item");
  await db.update(assessmentItems).set({ pinned }).where(and(eq(assessmentItems.id, itemId), eq(assessmentItems.assessmentId, id)));
  revalidatePath(`/app/provas/${id}`);
}

export async function moveAction(id: string, itemId: string, dir: "up" | "down") {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  const items = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, id)).orderBy(asc(assessmentItems.position));
  const i = items.findIndex((x) => x.id === itemId);
  const j = dir === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= items.length) return;
  await touch(id, "Reordenar");
  await db.update(assessmentItems).set({ position: items[j].position }).where(eq(assessmentItems.id, items[i].id));
  await db.update(assessmentItems).set({ position: items[i].position }).where(eq(assessmentItems.id, items[j].id));
  revalidatePath(`/app/provas/${id}`);
}

export async function removeItemAction(id: string, itemId: string) {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  await touch(id, "Remover item");
  await db.delete(assessmentItems).where(and(eq(assessmentItems.id, itemId), eq(assessmentItems.assessmentId, id)));
  await renumber(id);
  revalidatePath(`/app/provas/${id}`);
}

export async function replaceItemAction(id: string, itemId: string, questionId: string) {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  const [cur] = await db.select().from(assessmentItems).where(and(eq(assessmentItems.id, itemId), eq(assessmentItems.assessmentId, id))).limit(1);
  if (!q || !cur) return;
  if (checkIntegrity(toCandidate(q))) return; // só itens íntegros e liberados entram
  await touch(id, "Trocar item");
  await track("swap", ctx.user.id, ctx.org.id, { assessmentId: id });
  await db.update(assessmentItems).set({ questionId, reason: explainReason(q as QRow, q.assessed.filter((s) => a.scope.willFall.includes(s))), pinned: false, manual: false, scopeAck: false }).where(eq(assessmentItems.id, itemId));
  redirect(`/app/provas/${id}`);
}

export async function addManualAction(id: string, questionId: string) {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!q) return { error: "Questão não encontrada." };
  const bad = checkIntegrity(toCandidate(q));
  if (bad && !bad.ok) return { error: bad.reason };
  const items = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, id));
  if (items.some((i) => i.questionId === questionId)) return { error: "Esta questão já está na prova." };
  await touch(id, "Adicionar manualmente");
  const n = items.length + 1;
  const pts = evenPoints(Number(a.totalPoints), n);
  await db.insert(assessmentItems).values({ assessmentId: id, questionId, position: n, points: String(pts[n - 1]), manual: true, pinned: true, reason: "Adicionada manualmente pelo professor. " + explainReason(q as QRow, q.assessed) });
  const rows = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, id)).orderBy(asc(assessmentItems.position));
  for (let i = 0; i < rows.length; i++) await db.update(assessmentItems).set({ points: String(pts[i]) }).where(eq(assessmentItems.id, rows[i].id));
  revalidatePath(`/app/provas/${id}`);
  return { ok: "Adicionada ao rascunho." };
}

export async function addManualFormAction(id: string, questionId: string) {
  const r = await addManualAction(id, questionId);
  if ("error" in r) redirect(`/app/provas/${id}?erro=${encodeURIComponent(r.error!)}`);
  redirect(`/app/provas/${id}`);
}

export async function pointsAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  const items = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, id));
  const updates: { id: string; v: number }[] = [];
  for (const it of items) {
    const raw = fd.get(`pts_${it.id}`);
    if (raw == null) continue;
    const v = Number(String(raw).replace(",", "."));
    if (!isFinite(v) || v < 0 || v > 1000) return { error: "Valor de pontos inválido." };
    updates.push({ id: it.id, v });
  }
  await touch(id, "Ajustar valores");
  for (const u of updates) await db.update(assessmentItems).set({ points: String(u.v) }).where(eq(assessmentItems.id, u.id));
  revalidatePath(`/app/provas/${id}`);
  return { ok: "Valores atualizados." };
}

export async function redistributePointsAction(id: string) {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const items = await db.select().from(assessmentItems).where(eq(assessmentItems.assessmentId, id)).orderBy(asc(assessmentItems.position));
  const pts = evenPoints(Number(a.totalPoints), items.length);
  await touch(id, "Redistribuir pontos");
  for (let i = 0; i < items.length; i++) await db.update(assessmentItems).set({ points: String(pts[i]) }).where(eq(assessmentItems.id, items[i].id));
  revalidatePath(`/app/provas/${id}`);
}

export async function updateMetaAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  const p = z.object({ title: z.string().trim().min(1).max(140), durationMin: z.coerce.number().int().min(5).max(600), totalPoints: z.string().transform((v) => Number(v.replace(",", "."))).pipe(z.number().positive().max(1000)) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: "Confira título, duração e total de pontos." };
  await touch(id, "Editar título/duração");
  await db.update(assessments).set({ title: p.data.title, durationMin: p.data.durationMin, totalPoints: String(p.data.totalPoints) }).where(eq(assessments.id, id));
  revalidatePath(`/app/provas/${id}`);
  return { ok: "Salvo" };
}

export async function undoAction(id: string) {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  const h = await lastHistory(id);
  if (h) { await restoreHistory(id, h.id); await db.delete(assessmentHistory).where(eq(assessmentHistory.id, h.id)); }
  revalidatePath(`/app/provas/${id}`);
}

export async function restoreAction(id: string, historyId: string) {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  await restoreHistory(id, historyId);
  redirect(`/app/provas/${id}`);
}

export async function confirmConflictAction(id: string, itemId: string) {
  const ctx = await requireCtx();
  await loadAssessment(ctx, id);
  await touch(id, "Confirmar item fora do escopo");
  await db.update(assessmentItems).set({ scopeAck: true }).where(and(eq(assessmentItems.id, itemId), eq(assessmentItems.assessmentId, id)));
  revalidatePath(`/app/provas/${id}`);
}

export async function deleteAssessmentAction(id: string) {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const [{ n }] = [{ n: (await db.select({ id: applications.id }).from(applications).where(eq(applications.assessmentId, id))).length }];
  if (n > 0) redirect(`/app/provas/${id}?erro=${encodeURIComponent("Esta avaliação já foi aplicada e não pode ser excluída.")}`);
  await db.delete(assessments).where(eq(assessments.id, a.id));
  await audit(ctx.user.id, ctx.org.id, "assessment.deleted", id);
  redirect("/app/provas");
}

/* ---------- 4) Aplicação ---------- */
export async function createApplicationAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const classId = String(fd.get("classId") ?? a.classId ?? "");
  if (!classId) return { error: "Escolha a turma." };
  await loadClass(ctx, classId);
  const date = String(fd.get("appliedOn") ?? todayISO());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida." };
  const items = await getItems(id);
  if (!items.length) return { error: "A prova não tem questões." };
  const conflicts = await conflictsFor(id, a.scope);
  if (conflicts.length) return { error: "Há itens fora do escopo confirmado. Substitua-os ou confirme o novo escopo antes de aplicar." };
  const v = await ensureVersion(a, ctx.org.settings);
  const kind = a.parentId ? "second" : "regular";
  const parentApp = a.parentId ? (await db.select().from(applications).where(eq(applications.assessmentId, a.parentId)).orderBy(desc(applications.createdAt)).limit(1))[0] : undefined;
  const [app] = await db.insert(applications).values({ orgId: ctx.org.id, assessmentId: id, versionId: v.id, classId, kind, title: a.title, appliedOn: date, parentApplicationId: parentApp?.id }).returning();
  await db.update(assessments).set({ status: "applied", classId }).where(eq(assessments.id, id));
  await audit(ctx.user.id, ctx.org.id, "assessment.applied", app.id, { version: v.number });
  await track("application_created", ctx.user.id, ctx.org.id);
  redirect(`/app/provas/${id}/correcao?app=${app.id}`);
}

export async function registerExternalAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const classId = String(fd.get("classId") ?? "");
  const { cls } = await loadClass(ctx, classId);
  const title = String(fd.get("title") ?? "").trim();
  const date = String(fd.get("appliedOn") ?? todayISO());
  const key = String(fd.get("answerKey") ?? "").trim();
  if (!title) return { error: "Informe o título da avaliação." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Data inválida." };
  const total = Number(String(fd.get("totalPoints") ?? "10").replace(",", ".")) || 10;
  const parsed = parseAnswerKey(key, total);
  if ("error" in parsed) return { error: parsed.error };
  const [app] = await db.insert(applications).values({
    orgId: cls.orgId, classId: cls.id, kind: "external", title, appliedOn: date,
    external: { answerKey: parsed.key, points: parsed.points, rubrics: parsed.rubrics, version: String(fd.get("version") ?? ""), format: String(fd.get("format") ?? "") },
  }).returning();
  await audit(ctx.user.id, ctx.org.id, "application.external", app.id);
  redirect(`/app/turmas/${cls.id}/avaliacoes?app=${app.id}`);
}

/* ---------- 5) Segunda chamada ---------- */
export async function createSecondCallAction(id: string) {
  const ctx = await requireCtx();
  const a = await loadAssessment(ctx, id);
  const info = await planInfo(ctx.org.id);
  if (!info.features.second) redirect(`/app/provas/${id}/aplicacao?erro=${encodeURIComponent("Segunda chamada está disponível nos planos Professor e Escola.")}`);
  const items = await getItems(id);
  if (!items.length) redirect(`/app/provas/${id}?erro=${encodeURIComponent("A prova original não tem itens.")}`);
  const pool = await loadPool("matematica", ctx.org.id);
  // evita duplicatas entre cadernos: exclui as originais e quem compartilha estímulo com elas
  const usedIds = new Set(items.map((i) => i.q.id));
  const usedStim = new Set(items.map((i) => i.q.stimulusId).filter(Boolean));
  const usedTitles = new Set(items.map((i) => i.q.title));
  const clean = pool.filter((q) => !usedIds.has(q.id) && !(q.stimulusId && usedStim.has(q.stimulusId)) && !usedTitles.has(q.title));
  const { result, byId } = runSelection(clean, a.scope, { wantedCount: items.length, durationMin: a.durationMin, filters: a.filters }, []);
  const q = await consumeAssembly(ctx.org.id, "second:" + id + ":" + Date.now());
  if (!q.ok) redirect(`/app/provas/${id}/aplicacao?erro=${encodeURIComponent(q.reason)}`);
  const [b] = await db.insert(assessments).values({ orgId: a.orgId, classId: a.classId, ownerId: ctx.user.id, title: `${a.title} — 2ª chamada`, scope: a.scope, totalPoints: a.totalPoints, durationMin: a.durationMin, wantedCount: items.length, filters: a.filters, parentId: a.id }).returning();
  if (result.picks.length) {
    const pts = items.map((i) => i.item.points);
    await db.insert(assessmentItems).values(result.picks.map((pk, i) => ({ assessmentId: b.id, questionId: pk.id, position: i + 1, points: pts[i] ?? pts[pts.length - 1], reason: explainReason(byId.get(pk.id)!, pk.matched) })));
  }
  await audit(ctx.user.id, ctx.org.id, "assessment.second_call", b.id, { from: id });
  redirect(`/app/provas/${b.id}?achou=${result.found}&pedido=${items.length}`);
}

/* ---------- 6) Retomada e checagens a partir de resultados ---------- */
export async function createFollowUpAction(classId: string, kind: "retomada" | "checagem", fd: FormData) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  const topics = fd.getAll("topics").map(String).filter((s) => TOPICS.some((t) => t.slug === s));
  if (!topics.length) redirect(`/app/turmas/${classId}/relatorios?erro=${encodeURIComponent("Escolha ao menos um conteúdo.")}`);
  const scope: Scope = { willFall: topics, prerequisite: [], notTaught: [], confirm: [], sources: {} };
  const pool = await loadPool("matematica", ctx.org.id);
  const allTopics = new Set(topics);
  for (const q of pool) for (const s of q.assessed) if (allTopics.has(s)) for (const p of q.prerequisites) if (!allTopics.has(p)) scope.prerequisite.push(p);
  scope.prerequisite = [...new Set(scope.prerequisite)];
  const wanted = kind === "checagem" ? 3 : 6;
  const used = await usedQuestionIdsForClass(cls.id);
  const { result, byId } = runSelection(pool, scope, { wantedCount: wanted, durationMin: kind === "checagem" ? 10 : 40, filters: {} }, used);
  if (!result.picks.length) redirect(`/app/turmas/${classId}/relatorios?erro=${encodeURIComponent("Não há questões liberadas e compatíveis para esses conteúdos no acervo.")}`);
  const q = await consumeAssembly(ctx.org.id, `${kind}:${cls.id}:${Date.now()}`);
  if (!q.ok) redirect(`/app/turmas/${classId}/relatorios?erro=${encodeURIComponent(q.reason)}`);
  const title = kind === "checagem" ? `Checagem — ${cls.name}` : `Retomada — ${cls.name}`;
  const [a] = await db.insert(assessments).values({ orgId: ctx.org.id, classId, ownerId: ctx.user.id, title, scope, wantedCount: wanted, durationMin: kind === "checagem" ? 10 : 40, totalPoints: kind === "checagem" ? "3" : "10" }).returning();
  const pts = evenPoints(kind === "checagem" ? 3 : 10, result.picks.length);
  await db.insert(assessmentItems).values(result.picks.map((pk, i) => ({
    assessmentId: a.id, questionId: pk.id, position: i + 1, points: String(pts[i]),
    reason: (byId.get(pk.id)!.assessed.some((s) => topics.includes(s)) ? "Prática do conteúdo em foco. " : "Pré-requisito. ") + explainReason(byId.get(pk.id)!, pk.matched),
  })));
  redirect(`/app/provas/${a.id}?achou=${result.found}&pedido=${wanted}`);
}
