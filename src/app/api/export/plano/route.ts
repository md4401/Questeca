import { NextResponse } from "next/server";
import { getStaffCtx } from "@/lib/session";
import { loadPlan } from "@/app/app/planos-de-aula/actions";
import { renderPlanDocx } from "@/lib/plan-docx";
import { slug } from "@/lib/export-helpers";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const ctx = await getStaffCtx();
  if (!ctx) return new NextResponse("Não autenticado", { status: 401 });
  const p = await loadPlan(ctx, new URL(req.url).searchParams.get("id") ?? "");
  if (!p) return new NextResponse("Não encontrado", { status: 404 });
  const buf = await renderPlanDocx(p.content);
  return new NextResponse(new Uint8Array(buf), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "content-disposition": `attachment; filename="plano-${slug(p.theme)}.docx"` } });
}
