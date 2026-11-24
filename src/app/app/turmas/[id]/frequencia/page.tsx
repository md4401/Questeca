import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { FrequenciaPanel } from "@/components/frequencia-panel";

export const metadata = { title: "Frequência" };

export default async function Frequencia({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ data?: string; aula?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await requireCtx();
  const { cls } = await loadClass(ctx, id);
  return <FrequenciaPanel ctx={ctx} cls={cls} sp={sp} />;
}
