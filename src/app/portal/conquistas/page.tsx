import { requirePortal } from "@/lib/portal";
import { StudentSwitch } from "@/components/student-switch";
import { studentProfile, classXp, gamificationOn } from "@/lib/gamification";
import { rank, XP_RULES, MISSIONS } from "@/lib/core/gamification";
import { db } from "@/db";
import { students } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { fmtDateTime } from "@/lib/format";

export const metadata = { title: "Conquistas" };
const RAR = { comum: "Comum", rara: "Rara", epica: "Épica" };

export default async function Conquistas({ searchParams }: { searchParams: Promise<{ aluno?: string }> }) {
  const sp = await searchParams; const p = await requirePortal(sp.aluno);
  if (!(await gamificationOn(p.ctx.org.id))) return <div className="space-y-4"><h1>Conquistas</h1><p className="card text-ink-soft">A escola não ativou conquistas, XP e missões.</p></div>;
  const prof = await studentProfile(p.ctx.org.id, p.student.id);
  const showBoard = p.ctx.org.settings.gamification?.leaderboard === true;
  let board: { pos: number; display: string; xp: number; me: boolean }[] = [];
  if (showBoard && p.classIds[0]) {
    const xp = await classXp(p.classIds[0]);
    const names = xp.size ? await db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.id, [...xp.keys()])) : [];
    board = rank([...xp].map(([id, x]) => ({ id, name: names.find((n) => n.id === id)?.name ?? "Aluno", xp: x }))).map((r) => ({ pos: r.pos, display: r.display, xp: r.xp, me: r.id === p.student.id })).slice(0, 10);
  }
  const daily = prof.missions.filter((x) => x.m.period === "daily"); const weekly = prof.missions.filter((x) => x.m.period === "weekly");
  return (
    <div className="space-y-6">
      <StudentSwitch list={p.students} active={p.student.id} base="/portal/conquistas" />
      <h1>Conquistas</h1>
      <section className="card"><p className="text-sm text-ink-soft">{p.student.name}</p>
        <div className="mt-1 flex flex-wrap items-end gap-x-6 gap-y-2"><p className="display text-4xl">Nível {prof.level.level}</p><p className="text-lg font-semibold">{prof.xp} XP</p><p><span className="badge">Liga {prof.league.name}</span></p><p className="font-semibold">🔥 {prof.streak} dia(s) seguidos</p></div>
        <div className="mt-3" role="progressbar" aria-valuenow={prof.level.into} aria-valuemin={0} aria-valuemax={prof.level.next} aria-label="Progresso para o próximo nível"><div className="h-3 overflow-hidden rounded-full bg-brand-tint"><div className="h-full rounded-full bg-brand" style={{ width: `${(prof.level.into / prof.level.next) * 100}%` }} /></div><p className="hint mt-1">{prof.level.into}/{prof.level.next} XP para o nível {prof.level.level + 1}{prof.league.next ? ` · próxima liga: ${prof.league.next.name} em ${prof.league.next.min} XP` : ""}</p></div>
        <p className="hint mt-2">O XP reconhece esforço e constância (entregar, praticar, participar). Ele nunca diminui.</p></section>
      <section className="card"><h2 className="mb-2 text-lg">Missões</h2>
        {[["Hoje", daily], ["Esta semana", weekly]].map(([title, list]) => (<div key={title as string} className="mb-3"><h3 className="text-sm font-bold text-ink-soft">{title as string}</h3>
          <ul className="space-y-2">{(list as typeof prof.missions).map(({ m, n, done }) => <li key={m.id} className="text-sm"><div className="flex justify-between gap-2"><span>{done ? "✅ " : ""}{m.name}</span><span className="hint">{n}/{m.goal} · +{m.reward} XP</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-tint" role="progressbar" aria-valuenow={n} aria-valuemin={0} aria-valuemax={m.goal} aria-label={m.name}><div className="h-full bg-brand" style={{ width: `${(n / m.goal) * 100}%` }} /></div></li>)}</ul></div>))}
      </section>
      <section className="card"><h2 className="mb-2 text-lg">Conquistas ({prof.unlocked.size}/{prof.achievements.length})</h2>
        <ul className="grid gap-3 sm:grid-cols-2">{prof.achievements.map((a) => { const at = prof.unlocked.get(a.id); return (
          <li key={a.id} className={`rounded-xl border p-3 ${at ? "border-brand bg-brand-tint" : "border-line opacity-90"}`}><p className="flex items-center gap-2 font-semibold"><span aria-hidden className="text-2xl">{at ? a.icon : "🔒"}</span>{a.name}<span className="badge">{RAR[a.rarity]}</span></p><p className="text-sm text-ink-soft">{a.desc}</p><p className="hint">{at ? `Desbloqueada em ${fmtDateTime(at)}` : `Recompensa: +${a.reward} XP`}</p></li>); })}</ul></section>
      {showBoard && board.length > 0 && <section className="card"><h2 className="mb-2 text-lg">Ranking da turma</h2><ol className="space-y-1 text-sm">{board.map((r) => <li key={r.pos + r.display + r.xp} className={r.me ? "font-bold" : ""}>{r.pos}º {r.display} — {r.xp} XP{r.me ? " (você)" : ""}</li>)}</ol><p className="hint mt-2">Mostra só o primeiro nome. A escola pode desligar o ranking.</p></section>}
      <section className="card"><h2 className="mb-2 text-lg">Extrato de XP</h2><p className="hint mb-2">Cada recompensa tem um motivo registrado. Regras: acesso +{XP_RULES.access}, tarefa no prazo +{XP_RULES.task_on_time}, com atraso +{XP_RULES.task_late}, quiz +{XP_RULES.quiz_done} e bônus pelo acerto, presença +{XP_RULES.attendance}, videoaula +{XP_RULES.study}. {MISSIONS.length} missões ativas.</p>
        {prof.history.length === 0 ? <p className="text-sm text-ink-soft">Ainda sem eventos.</p> : <ul className="space-y-1 text-sm">{prof.history.map((h) => <li key={h.id}>+{h.points} XP · {h.label} <span className="hint">· {fmtDateTime(h.createdAt)}</span></li>)}</ul>}</section>
    </div>
  );
}
