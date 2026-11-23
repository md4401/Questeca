import { NextResponse } from "next/server";
import { getStaffCtx as getCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { loadGradebook, rulesFrom, cellLabel } from "@/lib/gradebook";
import { renderGradesSummary } from "@/lib/pdf";
import { pdfResponse, slug } from "@/lib/export-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const u = new URL(req.url);
  let r;
  try { r = await loadClass(ctx, u.searchParams.get("turma") ?? ""); } catch { return new NextResponse("Não encontrado", { status: 404 }); }
  const rules = rulesFrom(ctx.org.settings);
  const period = rules.periods.includes(u.searchParams.get("periodo") ?? "") ? u.searchParams.get("periodo")! : rules.periods[0];
  const gb = await loadGradebook(r.cls.id, period, rules);
  const bytes = await renderGradesSummary({
    title: `Notas — ${r.cls.name}`, school: ctx.org.settings.header?.schoolName ?? ctx.org.name, period,
    items: gb.items.map((i) => ({ title: i.title, weight: Number(i.weight) })),
    rows: gb.rows.map((row) => ({ name: row.student.name, cells: row.cells.map((c) => cellLabel(c) || "—"), average: row.computed.average == null ? "—" : String(row.computed.average).replace(".", ","), partial: row.computed.partial })),
  });
  return pdfResponse(bytes, `notas-${slug(r.cls.name)}-${slug(period)}.pdf`);
}
