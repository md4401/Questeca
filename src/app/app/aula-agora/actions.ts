"use server";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { saveAttendanceAction } from "../turmas/[id]/frequencia/actions";
import { nowInSP } from "@/lib/core/lesson-now";
import type { FormState } from "@/components/form";

/** Chamada de um toque: todos presentes; quem for marcado "Falta" fica ausente. Reaproveita a regra auditada da chamada (uma por turma/data/aula). */
export async function quickAttendanceAction(classId: string, lesson: string, _: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireCtx();
  await loadClass(ctx, classId);
  const out = new FormData();
  out.set("date", nowInSP(new Date()).dateISO); out.set("lesson", lesson);
  const absent = new Set(fd.getAll("absent").map(String));
  for (const s of await classStudents(classId)) out.set(`st_${s.id}`, absent.has(s.id) ? "absent" : "present");
  const r = await saveAttendanceAction(classId, null, out);
  if (r?.error?.includes("já foi registrada")) return { error: "A chamada desta aula já foi registrada. Para corrigir, abra a Frequência da turma." };
  return r;
}
