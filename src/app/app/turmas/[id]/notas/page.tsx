import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { rulesFrom } from "@/lib/gradebook";
import { NotasPanel } from "@/app/app/notas/panel";

export const metadata = { title: "Notas" };

export default async function Notas({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ periodo?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const rules = rulesFrom(ctx.org.settings);
  const period = rules.periods.includes(sp.periodo ?? "") ? sp.periodo! : rules.periods[0];
  return <NotasPanel ctx={ctx} id={id} period={period} periodHref={(p) => `/app/turmas/${id}/notas?periodo=${encodeURIComponent(p)}`} />;
}
