import { requireCtx } from "@/lib/session";
import { loadClass, classStudents } from "@/lib/access";
import { classXp } from "@/lib/gamification";
import { levelOf, leagueOf } from "@/lib/core/gamification";

export const metadata = { title: "Engajamento" };
export default async function Engajamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireCtx();
  await loadClass(ctx, id);
  const roster = await classStudents(id); const xp = await classXp(id);
  const on = ctx.org.settings.gamification?.enabled ?? true;
  const rows = roster.map((s) => ({ ...s, xp: xp.get(s.id) ?? 0 })).sort((a, b) => b.xp - a.xp);
  return (
    <section className="card"><h2 className="mb-1 text-lg">Engajamento da turma</h2>
      <p className="hint mb-3">{on ? "XP, níveis e ligas reconhecem esforço e constância. O professor vê todos; o ranking para alunos só aparece se a escola ativar." : "A escola desativou conquistas, XP e missões."} Regras e opções em <a href="/app/escola">Regras da escola</a>.</p>
      {rows.length === 0 ? <p className="text-ink-soft">Sem alunos.</p> : <table className="t"><thead><tr><th>Aluno</th><th>XP</th><th>Nível</th><th>Liga</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.xp}</td><td>{levelOf(r.xp)}</td><td>{leagueOf(r.xp).name}</td></tr>)}</tbody></table>}</section>
  );
}
