import { NextResponse } from "next/server";
import { edicoes } from "@/lib/catalogo";
import { resolverDownload } from "@/lib/download";

/** Redireciona ao arquivo no site oficial. Só aceita ids do catálogo: nunca redireciona para um endereço vindo do visitante. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string; n: string }> }) {
  const { id, n } = await params;
  const destino = resolverDownload(edicoes, id, n);
  if (!destino) return new NextResponse("Arquivo não encontrado", { status: 404 });
  return NextResponse.redirect(destino, { status: 302, headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "public, max-age=300" } });
}
