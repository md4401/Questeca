import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { questionImages } from "@/db/schema";
import { getStaffCtx } from "@/lib/session";

/** Figura recortada do PDF oficial de uma questão. Só para a equipe logada (professores, coordenação). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!(await getStaffCtx())) return new NextResponse("Não autorizado", { status: 401 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse("Não encontrada", { status: 404 });
  const [img] = await db.select({ data: questionImages.data, mime: questionImages.mime }).from(questionImages).where(eq(questionImages.id, id)).limit(1);
  if (!img) return new NextResponse("Não encontrada", { status: 404 });
  return new NextResponse(new Uint8Array(img.data), { headers: { "content-type": img.mime, "cache-control": "private, max-age=86400, immutable", "x-content-type-options": "nosniff" } });
}
