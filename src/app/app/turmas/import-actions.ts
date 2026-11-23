"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db } from "@/db";
import { gradeItems, grades } from "@/db/schema";
import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { parseGradeInput } from "@/lib/core/grades";
import { normalize } from "@/lib/taxonomy";
import { saveGrade } from "./actions";
import { audit } from "@/lib/audit";

export type SheetData = { headers: string[]; rows: string[][] };
export type ImportLine = {
  line: number; label: string; studentId: string | null; raw: string;
  status: "novo" | "atualizacao" | "igual" | "vazio" | "erro";
  message?: string; before?: string; include: boolean;
};

const MAX_BYTES = 2_000_000;

export async function parseSheetFile(fd: FormData): Promise<SheetData | { error: string }> {
  await requireCtx();
  const f = fd.get("file");
  if (!(f instanceof File) || f.size === 0) return { error: "Escolha um arquivo CSV ou Excel (.xlsx)." };
  if (f.size > MAX_BYTES) return { error: "Arquivo muito grande (máximo 2 MB)." };
  const name = f.name.toLowerCase();
  const buf = Buffer.from(await f.arrayBuffer());
  let table: string[][] = [];
  try {
    if (name.endsWith(".xlsx")) {
      const { readSheet } = await import("read-excel-file/node");
      const data = await readSheet(buf);
      table = data.map((r) => r.map((c) => (c == null ? "" : c instanceof Date ? c.toISOString().slice(0, 10) : String(c))));
    } else if (name.endsWith(".csv") || name.endsWith(".txt") || name.endsWith(".tsv")) {
      const text = buf.toString("utf8").replace(/^﻿/, "");
      const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
      table = parsed.data.map((r) => r.map((c) => String(c ?? "")));
    } else return { error: "Formato não suportado. Use .csv ou .xlsx." };
  } catch {
    return { error: "Não foi possível ler o arquivo. Confira se ele não está protegido ou corrompido." };
  }
  table = table.filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length < 2) return { error: "O arquivo precisa ter um cabeçalho e ao menos uma linha." };
  if (table.length > 3001) return { error: "Limite de 3.000 linhas por importação." };
  return { headers: table[0].map((h) => h.trim()), rows: table.slice(1) };
}

/** Prévia: casa alunos por matrícula (preferida) ou nome; mostra novos, atualizações, vazios e erros. */
export async function previewGradeImport(
  classId: string, itemId: string,
  map: { keyCol: number; keyKind: "registration" | "name"; valueCol: number }, rows: string[][],
): Promise<{ lines: ImportLine[] } | { error: string }> {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return { error: "Escolha a atividade de destino." };
  const [item] = await db.select().from(gradeItems).where(and(eq(gradeItems.id, itemId), eq(gradeItems.classId, cls.id))).limit(1);
  if (!item) return { error: "Escolha a atividade de destino." };
  const studs = await classStudents(cls.id);
  const existing = await db.select().from(grades).where(eq(grades.gradeItemId, itemId));
  const exMap = new Map(existing.map((g) => [g.studentId, g]));
  const seenStudents = new Set<string>();
  const lines: ImportLine[] = rows.map((r, i) => {
    const key = (r[map.keyCol] ?? "").trim();
    const raw = (r[map.valueCol] ?? "").trim();
    const base = { line: i + 2, label: key || "(sem identificação)", raw, studentId: null as string | null };
    if (!key) return { ...base, status: "erro", message: "Linha sem matrícula/nome.", include: false };
    let matches = map.keyKind === "registration" ? studs.filter((s) => (s.registration ?? "").trim() === key) : studs.filter((s) => normalize(s.name).replace(/\s+/g, " ") === normalize(key).replace(/\s+/g, " "));
    if (matches.length === 0) return { ...base, status: "erro", message: "Aluno não encontrado nesta turma.", include: false };
    if (matches.length > 1) return { ...base, status: "erro", message: "Mais de um aluno corresponde (homônimos). Use a matrícula.", include: false };
    const stu = matches[0];
    if (seenStudents.has(stu.id)) return { ...base, label: stu.name, studentId: stu.id, status: "erro", message: "Aluno repetido no arquivo.", include: false };
    seenStudents.add(stu.id);
    if (raw === "") return { ...base, label: stu.name, studentId: stu.id, status: "vazio", message: "Célula vazia: ficará pendente (não vira zero).", include: false };
    const parsed = parseGradeInput(raw, Number(item.maxPoints));
    if ("error" in parsed) return { ...base, label: stu.name, studentId: stu.id, status: "erro", message: parsed.error, include: false };
    const ex = exMap.get(stu.id);
    const exLabel = ex && ex.state !== "pending" ? (ex.state === "value" ? String(ex.value).replace(".", ",") : ex.state === "zero" ? "0" : ex.state === "absent" ? "F" : "N") : undefined;
    if (ex && ex.state === parsed.state && Number(ex.value ?? -1) === Number(parsed.value ?? -1)) return { ...base, label: stu.name, studentId: stu.id, status: "igual", message: "Mesmo valor já lançado.", include: false };
    if (exLabel !== undefined) return { ...base, label: stu.name, studentId: stu.id, status: "atualizacao", before: exLabel, message: `Atualiza ${exLabel} → ${raw}. Confirme.`, include: false };
    return { ...base, label: stu.name, studentId: stu.id, status: "novo", include: true };
  });
  return { lines };
}

export async function commitGradeImport(classId: string, itemId: string, picks: { studentId: string; raw: string }[]) {
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, classId);
  let ok = 0; const errors: string[] = [];
  for (const p of picks.slice(0, 3000)) {
    const r = await saveGrade(cls.id, itemId, p.studentId, p.raw, { source: "import" });
    if ("error" in r) errors.push(r.error as string); else ok++;
  }
  await audit(ctx.user.id, ctx.org.id, "grades.imported", itemId, { ok, errors: errors.length });
  revalidatePath(`/app/turmas/${cls.id}/notas`);
  return { ok, errors };
}
