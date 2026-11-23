"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { materials, assessments } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { extractTextFromFile } from "@/lib/materials";
import { extractTopics, extractExclusions } from "@/lib/taxonomy";
import { validHttpUrl } from "@/lib/core/chat";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

export async function addMaterialAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const title = String(fd.get("title") ?? "").trim();
  const kind = String(fd.get("kind") ?? "teoria");
  const classId = String(fd.get("classId") ?? "") || null;
  if (classId) await loadClass(ctx, classId);
  let text = String(fd.get("text") ?? "").trim();
  let file: Buffer | null = null; let fileName: string | null = null; let fileType: string | null = null;
  const f = fd.get("file");
  if (f instanceof File && f.size > 0) {
    const r = await extractTextFromFile(f);
    if ("text" in r) text = `${text}\n\n${r.text}`.trim(); else if (!text) return { error: r.error };
    file = Buffer.from(await f.arrayBuffer()); fileName = f.name; fileType = f.type;
  }
  if (!title && !fileName) return { error: "Informe um título ou envie um arquivo." };
  const url = String(fd.get("url") ?? "").trim();
  if (url && !validHttpUrl(url)) return { error: "O link deve começar com http:// ou https://." };
  const visibility = ["private", "class", "school"].includes(String(fd.get("visibility"))) ? String(fd.get("visibility")) : "private";
  if (visibility === "class" && !classId) return { error: "Para compartilhar com alunos, escolha a turma." };
  if (!text && !file && !url) return { error: "Escreva um texto, envie um arquivo ou informe um link." };
  const tags = String(fd.get("tags") ?? "").split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 10);
  // Em escola, compartilhar (turma ou colegas) depende de aprovação da coordenação; no espaço pessoal não há aprovador.
  const needsApproval = visibility !== "private" && ctx.org.kind === "school" && ctx.org.role !== "coordinator" && ctx.org.role !== "admin";
  await db.insert(materials).values({ orgId: ctx.org.id, ownerId: ctx.user.id, classId, title: title || fileName || url, kind, text: text || null, file, fileName, fileType, url: url || null, description: String(fd.get("description") ?? "").trim().slice(0, 500) || null, subject: String(fd.get("subject") ?? "").trim() || null, tags, visibility, approval: needsApproval ? "pending" : "approved", approvedBy: needsApproval ? null : ctx.user.id });
  revalidatePath("/app/materiais");
  return { ok: needsApproval ? "Material salvo. O compartilhamento aguarda aprovação da coordenação." : "Material salvo." };
}

export async function deleteMaterialAction(id: string) {
  const ctx = await requireCtx();
  await db.delete(materials).where(and(eq(materials.id, id), eq(materials.ownerId, ctx.user.id)));
  revalidatePath("/app/materiais");
}

/** “Usar como teoria”: o arquivo ajuda a confirmar o conteúdo e inicia uma prova com o escopo extraído. */
export async function useAsTheoryAction(id: string) {
  const ctx = await requireCtx();
  const [m] = await db.select().from(materials).where(and(eq(materials.id, id), eq(materials.ownerId, ctx.user.id))).limit(1);
  if (!m?.text) redirect("/app/materiais");
  const scope = { willFall: [] as string[], prerequisite: [] as string[], notTaught: [] as string[], confirm: [] as string[], sources: {} as Record<string, string> };
  const excl = new Set(extractExclusions(m.text));
  for (const t of extractTopics(m.text)) { scope.sources[t.slug] = t.excerpt; if (excl.has(t.slug)) scope.notTaught.push(t.slug); else scope.willFall.push(t.slug); }
  const [a] = await db.insert(assessments).values({ orgId: ctx.org.id, classId: m.classId, ownerId: ctx.user.id, title: `Prova — ${m.title}`.slice(0, 140), scope }).returning();
  redirect(`/app/provas/${a.id}/escopo`);
}

/** Aprovação do compartilhamento: só coordenação/gestão da escola. */
export async function approveMaterialAction(id: string, approve: boolean) {
  const ctx = await requireCtx();
  if (ctx.org.role !== "coordinator" && ctx.org.role !== "admin") return;
  await db.update(materials).set({ approval: approve ? "approved" : "rejected", approvedBy: ctx.user.id }).where(and(eq(materials.id, id), eq(materials.orgId, ctx.org.id)));
  await audit(ctx.user.id, ctx.org.id, approve ? "material.approved" : "material.rejected", id);
  revalidatePath("/app/materiais");
}
