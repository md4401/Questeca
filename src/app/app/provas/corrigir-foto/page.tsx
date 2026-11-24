import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { PageHead } from "@/components/page-head";
import { CorrigirFoto } from "./corrigir-foto";

export const metadata = { title: "Corrigir por foto" };
export default async function Page() {
  await requireCtx();
  return (
    <div className="space-y-4">
      <PageHead icon="chamada" title="Corrigir resposta por foto" sub="Fotografe a resposta escrita à mão: a GizIA transcreve e sugere nota e comentário pelo seu critério. Você decide." actions={<Link className="btn btn-ghost" href="/app/escanear">Cartão-resposta (QR)</Link>} />
      <CorrigirFoto />
    </div>
  );
}
