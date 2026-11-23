import { NextResponse } from "next/server";
import { getStaffCtx as getCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { loadGradebook, rulesFrom, cellLabel } from "@/lib/gradebook";
import { slug } from "@/lib/export-helpers";

export const runtime = "nodejs";

const csvCell = (v: string) => {
  // proteção contra injeção de fórmula em planilhas
  const safe = /^[=+\-@]/.test(v) && !/^-?\d+([.,]\d+)?$/.test(v) ? `'${v}` : v;
  return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const u = new URL(req.url);
  let r;
  try { r = await loadClass(ctx, u.searchParams.get("turma") ?? ""); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  const rules = rulesFrom(ctx.org.settings);
  const period = rules.periods.includes(u.searchParams.get("periodo") ?? "") ? u.searchParams.get("periodo")! : rules.periods[0];
  const gb = await loadGradebook(r.cls.id, period, rules);
  const head = ["Matrícula", "Aluno", ...gb.items.map((i) => i.title), "Média", "Parcial"];
  const lines = [head.map(csvCell).join(";")];
  for (const row of gb.rows) {
    lines.push([row.student.registration ?? "", row.student.name, ...row.cells.map(cellLabel), row.computed.average == null ? "" : String(row.computed.average).replace(".", ","), row.computed.partial ? "sim" : "não"].map(csvCell).join(";"));
  }
  return new Response("﻿" + lines.join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="notas-${slug(r.cls.name)}-${slug(period)}.csv"`, "Cache-Control": "private, no-store" } });
}
