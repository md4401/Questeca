import { eq, desc } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { db } from "@/db";
import { classWeeks } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { semanaDe } from "@/lib/core/semana";
import { todayISO, fmtDate } from "@/lib/format";
import { salvarSemanaAction } from "./actions";

export const metadata = { title: "Matéria da semana" };
export default async function Semana({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const ctx = await requireCtx(); await loadClass(ctx, id);
  const rows = await db.select().from(classWeeks).where(eq(classWeeks.classId, id)).orderBy(desc(classWeeks.weekOf)).limit(8);
  const hoje = semanaDe(todayISO()); const atual = rows.find((r) => r.weekOf === hoje);
  const token = rows[0]?.token;
  const base = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "";
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card"><h2 className="mb-1 text-lg">Semana de {fmtDate(hoje)}</h2><p className="hint mb-3">O que foi dado e a tarefa. Os alunos e responsáveis veem numa página simples, sem login.</p>
        <Form action={salvarSemanaAction.bind(null, id)} toast>
          <div className="field"><label htmlFor="content">Conteúdo da semana</label><textarea id="content" name="content" className="input min-h-[8rem]" defaultValue={atual?.content ?? ""} placeholder="Ex.: Função do 2º grau — vértice e raízes." /></div>
          <div className="field"><label htmlFor="homework">Tarefa / para casa</label><textarea id="homework" name="homework" className="input min-h-[5rem]" defaultValue={atual?.homework ?? ""} /></div>
          <div className="field"><label htmlFor="links">Links (um por linha: Texto | https://…)</label><textarea id="links" name="links" className="input" defaultValue={(atual?.links ?? []).map((l) => `${l.label} | ${l.url}`).join("\n")} /></div>
          <label className="mb-3 flex gap-2 font-normal"><input type="checkbox" name="published" defaultChecked={atual?.published ?? true} />Mostrar no link público</label>
          <SubmitButton>Salvar</SubmitButton></Form></section>
      <section className="card h-fit"><h2 className="mb-2 text-lg">Link para a turma</h2>
        {token ? (<><p className="break-all rounded-lg bg-brand-tint p-2 text-sm" data-testid="link-publico">{base}/s/{token}</p><p className="hint mt-2">O mesmo link vale o ano todo: sempre mostra a semana mais recente publicada. Mande no grupo da turma ou projete o QR.</p></>) : <p className="text-sm text-ink-soft">O link aparece depois do primeiro salvamento.</p>}
        {rows.length > 1 && <><h3 className="mb-1 mt-4 text-base">Semanas anteriores</h3><ul className="text-sm text-ink-soft">{rows.slice(1).map((r) => <li key={r.id}>{fmtDate(r.weekOf)} — {r.content.slice(0, 50) || "(vazio)"}</li>)}</ul></>}</section>
    </div>
  );
}
