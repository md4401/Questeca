"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { buildDocument, DOC_KINDS } from "@/lib/docs";
import { can } from "@/lib/core/permissions";
import { audit, notify } from "@/lib/audit";
import type { FormState } from "@/components/form";

export async function createDocumentAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const kind = String(fd.get("kind") ?? "");
  if (!DOC_KINDS[kind]) return { error: "Escolha o tipo de documento." };
  const classId = String(fd.get("classId") ?? "");
  if (!classId) return { error: "Escolha a turma." };
  const { cls, role } = await loadClass(ctx, classId);
  const studentId = String(fd.get("studentId") ?? "") || undefined;
  if (DOC_KINDS[kind].needsStudent && !studentId) return { error: "Escolha o aluno." };
  const built = await buildDocument(kind, { cls, settings: ctx.org.settings, period: String(fd.get("period") ?? "") || undefined, studentId, viewerId: ctx.user.id, viewerIsCoordinator: role === "coordinator" });
  const [d] = await db.insert(documents).values({ orgId: ctx.org.id, classId, studentId: studentId ?? null, kind, title: built.title, body: built.body, evidence: built.evidence, openGaps: built.gaps, authorId: ctx.user.id, dueOn: (String(fd.get("dueOn") ?? "") || null) }).returning();
  await audit(ctx.user.id, ctx.org.id, "document.created", d.id, { kind });
  redirect(`/app/documentos/${d.id}`);
}

async function loadDoc(id: string) {
  const ctx = await requireCtx();
  const [d] = await db.select().from(documents).where(and(eq(documents.id, id), eq(documents.orgId, ctx.org.id))).limit(1);
  if (!d) redirect("/app/documentos");
  const reviewer = ctx.org.kind === "school" && can(ctx.org.role, "doc.review");
  if (d.authorId !== ctx.user.id && !reviewer) redirect("/app/documentos");
  return { ctx, d, reviewer };
}

export async function saveDocumentAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const { d } = await loadDoc(id);
  if (d.status === "approved") return { error: "Documento aprovado. Crie uma nova versão para editar." };
  const body = String(fd.get("body") ?? "");
  const title = String(fd.get("title") ?? d.title).trim().slice(0, 160) || d.title;
  // lacunas resolvidas pelo professor são removidas somente se ele marcar
  const resolved = new Set(fd.getAll("resolved").map(String));
  await db.update(documents).set({ body, title, openGaps: d.openGaps.filter((g) => !resolved.has(g)), updatedAt: new Date(), status: d.status === "returned" ? "draft" : d.status }).where(eq(documents.id, id));
  revalidatePath(`/app/documentos/${id}`);
  return { ok: "Rascunho salvo." };
}

/** Em escola, a versão final exige revisão institucional; no espaço pessoal o próprio professor confirma. */
export async function submitDocumentAction(id: string) {
  const { ctx, d } = await loadDoc(id);
  if (ctx.org.kind === "school") {
    await db.update(documents).set({ status: "in_review", updatedAt: new Date() }).where(eq(documents.id, id));
    await audit(ctx.user.id, ctx.org.id, "document.submitted", id);
  } else {
    await db.update(documents).set({ status: "approved", reviewerId: ctx.user.id, updatedAt: new Date() }).where(eq(documents.id, id));
  }
  void d;
  redirect(`/app/documentos/${id}`);
}

export async function reviewDocumentAction(id: string, approve: boolean, _: FormState, fd: FormData): Promise<FormState> {
  const { ctx, d, reviewer } = await loadDoc(id);
  if (!reviewer) return { error: "Somente a coordenação revisa documentos." };
  const note = String(fd.get("note") ?? "").trim();
  if (!approve && note.length < 3) return { error: "Informe as observações para o professor." };
  await db.update(documents).set({ status: approve ? "approved" : "returned", reviewNote: note || null, reviewerId: ctx.user.id, updatedAt: new Date(), version: d.version + (approve ? 0 : 0) }).where(eq(documents.id, id));
  await notify(d.authorId, "sistema", approve ? "Documento aprovado" : "Documento devolvido com observações", d.title, `/app/documentos/${id}`);
  await audit(ctx.user.id, ctx.org.id, approve ? "document.approved" : "document.returned", id);
  revalidatePath(`/app/documentos/${id}`);
  return { ok: approve ? "Versão final aprovada." : "Devolvido ao professor com suas observações." };
}

export async function newVersionAction(id: string) {
  const { ctx, d } = await loadDoc(id);
  if (d.authorId !== ctx.user.id) redirect(`/app/documentos/${id}`);
  await db.update(documents).set({ status: "draft", version: d.version + 1, updatedAt: new Date() }).where(eq(documents.id, id));
  redirect(`/app/documentos/${id}`);
}
