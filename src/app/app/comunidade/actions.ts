"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { posts, comments, savedPosts, postFlags, userBlocks, students, memberships, materials } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { normalize } from "@/lib/taxonomy";
import { rateLimit } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import type { FormState } from "@/components/form";

/** Privacidade no mural: bloqueia nomes de estudantes, CPF e linguagem de nota/registro individual. */
export async function privacyProblem(userId: string, text: string): Promise<string | null> {
  const n = normalize(text);
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(text)) return "O texto parece conter um CPF. Remova dados pessoais.";
  if (/(nota|notas|media|boletim|prova respondida|prova corrigida)\s+(do|da|de)\s+(aluno|aluna|estudante)/.test(n)) return "Não publique notas, provas respondidas ou registros individuais de alunos no mural.";
  const mems = await db.select({ orgId: memberships.orgId }).from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
  if (mems.length) {
    const studs = await db.select({ name: students.name }).from(students).where(inArray(students.orgId, mems.map((m) => m.orgId)));
    for (const s of studs) {
      const parts = normalize(s.name).split(/\s+/).filter((p) => p.length > 2);
      if (parts.length >= 2 && n.includes(normalize(s.name))) return `O texto cita o nome de um estudante (“${s.name}”). Anonimize antes de publicar.`;
    }
  }
  return null;
}

export async function createPostAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const [blocked] = await db.select().from(userBlocks).where(eq(userBlocks.userId, ctx.user.id)).limit(1);
  if (blocked) return { error: "Sua conta está impedida de publicar. Fale com o suporte para recorrer." };
  if (!(await rateLimit(`post:${ctx.user.id}`, 15, 3600))) return { error: "Muitas publicações em pouco tempo." };
  const title = String(fd.get("title") ?? "").trim();
  const body = String(fd.get("body") ?? "").trim();
  const audience = String(fd.get("audience") ?? "general");
  if (title.length < 3) return { error: "Informe um título." };
  if (body.length < 5) return { error: "Escreva a mensagem." };
  if (audience === "school" && ctx.org.kind !== "school") return { error: "Selecione uma escola ativa para publicar em grupo privado." };
  const problem = await privacyProblem(ctx.user.id, `${title}\n${body}`);
  if (problem) return { error: problem };
  let attachment: Buffer | null = null; let attName: string | null = null; let attType: string | null = null;
  const f = fd.get("attachment");
  if (f instanceof File && f.size > 0) {
    if (fd.get("confirmAnon") !== "on") return { error: "Confirme que o anexo não contém nomes, fotos ou dados de estudantes." };
    if (f.size > 3_000_000) return { error: "Anexo muito grande (máx. 3 MB)." };
    if (!/^(application\/pdf|image\/(png|jpe?g|webp)|text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(f.type)) return { error: "Tipo de anexo não permitido (use PDF, DOCX, TXT ou imagem)." };
    attachment = Buffer.from(await f.arrayBuffer()); attName = f.name.slice(0, 120); attType = f.type;
  }
  const [p] = await db.insert(posts).values({
    authorId: ctx.user.id, orgId: audience === "school" ? ctx.org.id : null, title: title.slice(0, 160), body: body.slice(0, 8000),
    kind: String(fd.get("kind") ?? "duvida"), subject: "matematica", grade: String(fd.get("grade") ?? "") || null,
    attachment, attachmentName: attName, attachmentType: attType,
  }).returning();
  await audit(ctx.user.id, ctx.org.id, "post.created", p.id, { audience });
  redirect(`/app/comunidade/${p.id}`);
}

async function postAccess(ctx: Awaited<ReturnType<typeof requireCtx>>, postId: string) {
  const [p] = await db.select().from(posts).where(eq(posts.id, postId)).limit(1);
  if (!p || p.hidden) return null;
  if (p.orgId && !ctx.orgs.some((o) => o.id === p.orgId)) return null;
  return p;
}

export async function commentAction(postId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = await postAccess(ctx, postId);
  if (!p) return { error: "Publicação indisponível." };
  const [blocked] = await db.select().from(userBlocks).where(eq(userBlocks.userId, ctx.user.id)).limit(1);
  if (blocked) return { error: "Sua conta está impedida de comentar." };
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 2) return { error: "Escreva o comentário." };
  const problem = await privacyProblem(ctx.user.id, body);
  if (problem) return { error: problem };
  if (!(await rateLimit(`comment:${ctx.user.id}`, 40, 3600))) return { error: "Muitos comentários em pouco tempo." };
  await db.insert(comments).values({ postId, authorId: ctx.user.id, body: body.slice(0, 4000) });
  revalidatePath(`/app/comunidade/${postId}`);
  return { ok: "Comentário publicado." };
}

export async function editPostAction(postId: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const [p] = await db.select().from(posts).where(and(eq(posts.id, postId), eq(posts.authorId, ctx.user.id))).limit(1);
  if (!p) return { error: "Só o autor pode editar." };
  const body = String(fd.get("body") ?? "").trim();
  const problem = await privacyProblem(ctx.user.id, body);
  if (problem) return { error: problem };
  await db.update(posts).set({ body: body.slice(0, 8000) }).where(eq(posts.id, postId));
  revalidatePath(`/app/comunidade/${postId}`);
  return { ok: "Publicação atualizada." };
}

export async function toggleSaveAction(postId: string) {
  const ctx = await requireCtx();
  if (!(await postAccess(ctx, postId))) return;
  const [ex] = await db.select().from(savedPosts).where(and(eq(savedPosts.userId, ctx.user.id), eq(savedPosts.postId, postId))).limit(1);
  if (ex) await db.delete(savedPosts).where(and(eq(savedPosts.userId, ctx.user.id), eq(savedPosts.postId, postId)));
  else await db.insert(savedPosts).values({ userId: ctx.user.id, postId });
  revalidatePath(`/app/comunidade/${postId}`);
}

export async function flagPostAction(postId: string, commentId: string | null, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  if (!(await postAccess(ctx, postId))) return { error: "Publicação indisponível." };
  if (!(await rateLimit(`pflag:${ctx.user.id}`, 20, 3600))) return { error: "Muitas denúncias em pouco tempo." };
  await db.insert(postFlags).values({ postId, commentId, reporterId: ctx.user.id, reason: String(fd.get("reason") ?? "outro").slice(0, 60) });
  return { ok: "Denúncia enviada à moderação. Obrigado." };
}

/** Reutilizar um material: salva cópia em Materiais preservando a atribuição (só se houver anexo/texto autorizado). */
export async function saveToMaterialsAction(postId: string) {
  const ctx = await requireCtx();
  const p = await postAccess(ctx, postId);
  if (!p) return;
  await db.insert(materials).values({ orgId: ctx.org.id, ownerId: ctx.user.id, title: `${p.title} (comunidade)`, kind: "outro", text: `Origem: publicação na comunidade — autoria preservada.\n\n${p.body}`, file: p.attachment, fileName: p.attachmentName, fileType: p.attachmentType, fromPostId: p.id });
  redirect("/app/biblioteca");
}
