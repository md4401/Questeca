"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCtx } from "@/lib/session";
import { criarProvaPorTemas } from "@/lib/montar";
import type { FormState } from "@/components/form";

/** Dificuldade-alvo (1 a 5) pela série. As questões do banco têm dificuldade 3 por padrão, então é só uma preferência. */

/** Monta a prova a partir de temas, série e disciplina: pesquisa no banco, escolhe e abre direto no editor. */
export async function montarProvaAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  const p = z.object({
    title: z.string().trim().max(140).optional(),
    classId: z.string().optional(),
    grade: z.string().min(1, "Escolha a série."),
    subject: z.string().min(1, "Escolha a disciplina."),
    themes: z.string().trim().min(2, "Escreva ao menos um tema (ex.: Machado de Assis, funções, Revolução Francesa)."),
    count: z.coerce.number().int().min(1).max(60),
    dificuldade: z.coerce.number().int().min(0).max(5).optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const r = await criarProvaPorTemas(ctx, {
    title: p.data.title, classId: p.data.classId || null, grade: p.data.grade, subject: p.data.subject, count: p.data.count, dificuldade: p.data.dificuldade,
    insts: fd.getAll("inst").map(String).filter(Boolean), temas: p.data.themes.split(/[,;\n]+/),
  });
  if (!r.ok) return { error: r.error };
  redirect(`/app/provas/${r.id}/editar?novo=${r.found}-${r.wanted}`);
}
