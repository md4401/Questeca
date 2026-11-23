"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { responses, studentPresence, gradeItems, grades, gradeChanges, answerSheets } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadApplication, classStudents } from "@/lib/access";
import { applicationKey, scoreCell, applicationData } from "@/lib/correction";
import { normalizeResponse, scoreResponse } from "@/lib/core/answerkey";
import { consumeCard, planInfo } from "@/lib/billing";
import { audit, notify, track } from "@/lib/audit";
import { aiAvailable, readAnswerSheet } from "@/lib/ai";
import type { FormState } from "@/components/form";

export async function saveResponse(appId: string, studentId: string, position: number, raw: string) {
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  // consultas independentes em paralelo: reduz a latência de cada célula salva
  const [key, studs] = await Promise.all([applicationKey(app), classStudents(app.classId)]);
  const item = key.items.find((i) => i.position === position);
  if (!item) return { error: "Questão inexistente." };
  if (!studs.some((s) => s.id === studentId)) return { error: "Aluno não pertence à turma." };
  const norm = normalizeResponse(raw, item.key);
  if (norm.error) return { error: norm.error };
  if (norm.value === "" && item.key === "*") {
    await db.delete(responses).where(and(eq(responses.applicationId, appId), eq(responses.studentId, studentId), eq(responses.position, position)));
    return { ok: true as const, points: null as number | null };
  }
  const sc = scoreCell(item, norm.value);
  await Promise.all([
    db.insert(responses).values({ applicationId: appId, studentId, position, value: norm.value, status: sc.status, points: sc.points == null ? null : String(sc.points) })
      .onConflictDoUpdate({ target: [responses.applicationId, responses.studentId, responses.position], set: { value: norm.value, status: sc.status, points: sc.points == null ? null : String(sc.points) } }),
    // se estava marcado ausente e agora há resposta, volta a presente
    db.delete(studentPresence).where(and(eq(studentPresence.applicationId, appId), eq(studentPresence.studentId, studentId))),
  ]);
  return { ok: true as const, points: sc.points };
}

export async function saveResponsesBatch(appId: string, entries: { studentId: string; position: number; raw: string }[]) {
  const out: { studentId: string; position: number; error?: string }[] = [];
  for (const e of entries.slice(0, 1500)) {
    const r = await saveResponse(appId, e.studentId, e.position, e.raw);
    out.push({ studentId: e.studentId, position: e.position, error: "error" in r ? r.error : undefined });
  }
  return out;
}

export async function setPresence(appId: string, studentId: string, absent: boolean) {
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  if (!(await classStudents(app.classId)).some((s) => s.id === studentId)) return;
  if (absent) {
    await db.delete(responses).where(and(eq(responses.applicationId, appId), eq(responses.studentId, studentId)));
    await db.insert(studentPresence).values({ applicationId: appId, studentId, state: "absent" }).onConflictDoUpdate({ target: [studentPresence.applicationId, studentPresence.studentId], set: { state: "absent" } });
  } else {
    await db.delete(studentPresence).where(and(eq(studentPresence.applicationId, appId), eq(studentPresence.studentId, studentId)));
  }
  revalidatePath(`/app/provas`);
}

/** Lança as notas da aplicação na turma: presente → pontos; ausente → ausência; sem leitura completa → pendente. */
export async function publishGradesAction(appId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { app, cls } = await loadApplication(ctx, appId);
  const period = String(fd.get("period") ?? "");
  const weight = Number(String(fd.get("weight") ?? "1").replace(",", ".")) || 1;
  if (!period) return { error: "Escolha o período." };
  const data = await applicationData(app);
  const total = data.key.total;
  const [existing] = await db.select().from(gradeItems).where(eq(gradeItems.applicationId, appId)).limit(1);
  const item = existing ?? (await db.insert(gradeItems).values({ classId: cls.id, title: app.title, category: "prova", period, weight: String(weight), maxPoints: String(Math.round(total * 100) / 100), applicationId: appId }).returning())[0];
  if (existing) await db.update(gradeItems).set({ period, weight: String(weight), maxPoints: String(Math.round(total * 100) / 100) }).where(eq(gradeItems.id, existing.id));
  let ok = 0; let pending = 0; let absent = 0;
  for (const r of data.rows) {
    let state: string; let value: string | null = null;
    if (r.absent) { state = "absent"; absent++; }
    else if (!r.complete) { state = "pending"; pending++; }
    else { value = String(r.total); state = r.total === 0 ? "zero" : "value"; ok++; }
    const [before] = await db.select().from(grades).where(and(eq(grades.gradeItemId, item.id), eq(grades.studentId, r.student.id))).limit(1);
    if (before && before.state === state && Number(before.value ?? -1) === Number(value ?? -1)) continue;
    await db.insert(grades).values({ gradeItemId: item.id, studentId: r.student.id, state, value, source: "application", updatedBy: ctx.user.id })
      .onConflictDoUpdate({ target: [grades.gradeItemId, grades.studentId], set: { state, value, source: "application", updatedBy: ctx.user.id, updatedAt: new Date() } });
    await db.insert(gradeChanges).values({ gradeItemId: item.id, studentId: r.student.id, before: before ? { state: before.state, value: before.value } : null, after: { state, value }, actorId: ctx.user.id, source: "application" });
  }
  await audit(ctx.user.id, ctx.org.id, "grades.published", appId, { ok, pending, absent });
  await track("grades_published", ctx.user.id, ctx.org.id);
  revalidatePath(`/app/turmas/${cls.id}/notas`);
  return { ok: `Notas lançadas em “${period}”: ${ok} confirmada(s), ${absent} ausente(s), ${pending} pendente(s). Linhas pendentes ficam identificadas na turma.` };
}

/* ---------- Cartões fotografados ---------- */
export async function uploadSheetsAction(appId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const { app } = await loadApplication(ctx, appId);
  const info = await planInfo(ctx.org.id);
  if (!info.features.photoImport) return { error: "Correção por foto está disponível nos planos Professor e Escola. O lançamento manual continua disponível." };
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return { error: "Escolha uma ou mais fotos." };
  if (files.length > 60) return { error: "Envie no máximo 60 fotos por vez." };
  const key = await applicationKey(app);
  let added = 0; let dup = 0; const errors: string[] = [];
  for (const f of files) {
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) { errors.push(`${f.name}: formato inválido.`); continue; }
    if (f.size > 8_000_000) { errors.push(`${f.name}: imagem muito grande (máx. 8 MB).`); continue; }
    const buf = Buffer.from(await f.arrayBuffer());
    const hash = createHash("sha256").update(buf).digest("hex");
    const [exists] = await db.select({ id: answerSheets.id }).from(answerSheets).where(and(eq(answerSheets.applicationId, appId), eq(answerSheets.imageHash, hash))).limit(1);
    if (exists) { dup++; continue; }
    let detected: { answers: (string | null)[]; confidence: number[] } | null = null;
    let note: string | null = null;
    if (aiAvailable()) {
      try { detected = await readAnswerSheet(buf.toString("base64"), f.type, key.items.length); }
      catch { note = "Leitura automática indisponível: confira manualmente."; }
    } else note = "Leitura automática não configurada: preencha as respostas olhando a imagem.";
    await db.insert(answerSheets).values({ applicationId: appId, image: buf, contentType: f.type, imageHash: hash, detected, note, status: "pending_review" });
    added++;
  }
  revalidatePath(`/app/provas`);
  const parts = [`${added} foto(s) enviada(s) para conferência`]; if (dup) parts.push(`${dup} repetida(s) ignorada(s)`);
  if (errors.length) return { error: `${parts.join("; ")}. ${errors.join(" ")}` };
  return { ok: parts.join("; ") + "." };
}

export async function confirmSheetAction(sheetId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const [sheet] = await db.select().from(answerSheets).where(eq(answerSheets.id, sheetId)).limit(1);
  if (!sheet) return { error: "Cartão não encontrado." };
  const { app } = await loadApplication(ctx, sheet.applicationId);
  const studentId = String(fd.get("studentId") ?? "");
  if (!studentId) return { error: "Escolha o aluno deste cartão." };
  if (!(await classStudents(app.classId)).some((s) => s.id === studentId)) return { error: "Aluno de outra turma. Este cartão pertence a outra turma?" };
  const code = String(fd.get("code") ?? "").trim().toUpperCase();
  const key = await applicationKey(app);
  const expected = `${app.id.slice(0, 8).toUpperCase()}-V${key.versionNumber ?? 0}`;
  if (code && !code.startsWith(expected)) {
    await db.update(answerSheets).set({ note: `Divergência de versão: código ${code} ≠ ${expected}. Enviado para revisão.` }).where(eq(answerSheets.id, sheetId));
    return { error: `Código do cartão (${code}) não corresponde a esta aplicação/versão (${expected}). Cartão mantido para revisão.` };
  }
  const q = await consumeCard(ctx.org.id, `${app.id}:${studentId}`);
  if (!q.ok) return { error: q.reason };
  for (const it of key.items) {
    const raw = String(fd.get(`a${it.position}`) ?? "");
    const norm = normalizeResponse(raw, it.key);
    if (norm.error) return { error: `Questão ${it.position}: ${norm.error}` };
    if (norm.value === "" ) continue;
    const sc = scoreResponse({ key: it.key, points: it.points, value: norm.value, status: "answered" });
    await db.insert(responses).values({ applicationId: app.id, studentId, position: it.position, value: norm.value, status: sc.status, points: sc.points == null ? null : String(sc.points) })
      .onConflictDoUpdate({ target: [responses.applicationId, responses.studentId, responses.position], set: { value: norm.value, status: sc.status, points: sc.points == null ? null : String(sc.points) } });
  }
  // substituições: cartão anterior do mesmo aluno é descartado (sem duplicar resultado)
  const prev = await db.select().from(answerSheets).where(and(eq(answerSheets.applicationId, app.id), eq(answerSheets.studentId, studentId), eq(answerSheets.status, "confirmed")));
  for (const p of prev) await db.update(answerSheets).set({ status: "rejected", note: "Substituído por novo envio." }).where(eq(answerSheets.id, p.id));
  await db.update(answerSheets).set({ studentId, status: "confirmed", note: null }).where(eq(answerSheets.id, sheetId));
  await db.delete(studentPresence).where(and(eq(studentPresence.applicationId, app.id), eq(studentPresence.studentId, studentId)));
  await notify(ctx.user.id, "correcao", "Cartão conferido", `Cartão de ${app.title} confirmado.`, `/app/provas/${app.assessmentId}/correcao?app=${app.id}`);
  revalidatePath(`/app/provas`);
  return { ok: "Cartão confirmado e respostas gravadas." };
}

export async function rejectSheetAction(sheetId: string) {
  const ctx = await requireCtx();
  const [sheet] = await db.select().from(answerSheets).where(eq(answerSheets.id, sheetId)).limit(1);
  if (!sheet) return;
  await loadApplication(ctx, sheet.applicationId);
  await db.update(answerSheets).set({ status: "rejected" }).where(eq(answerSheets.id, sheetId));
  revalidatePath(`/app/provas`);
}

