import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { visibleClasses } from "@/lib/access";
import { Form, Field, SubmitButton } from "@/components/form";
import { GRADES, SUBJECTS } from "@/lib/taxonomy";
import { aiAvailable } from "@/lib/ai";
import { montarProvaAction } from "./actions";

export const metadata = { title: "Montar prova" };
const BANCAS = ["Fuvest", "Comvest", "Uerj", "Vunesp", "PUC-SP", "Mackenzie", "ESPM", "Questeca"];

export default async function Montar({ searchParams }: { searchParams: Promise<{ turma?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const classes = await visibleClasses(ctx);
  const cls = classes.find((c) => c.id === sp.turma);
  return (
    <div className="max-w-2xl">
      <h1>Montar prova</h1>
      <p className="hint mb-4">Escolha os temas e a série. A Questeca {aiAvailable() ? "usa IA para ampliar os temas e " : ""}pesquisa no banco, monta a prova e abre no editor, onde tudo pode ser mudado.</p>
      <Form action={montarProvaAction} className="card">
        <div className="field"><label htmlFor="themes">Temas da prova</label>
          <textarea id="themes" name="themes" className="input" style={{ minHeight: 90 }} placeholder="Ex.: Machado de Assis, Realismo, ironia" />
          <span className="hint">Separe por vírgula. Pode ser um autor, uma obra, um assunto ou vários.</span></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="field"><label htmlFor="subject">Disciplina</label>
            <select id="subject" name="subject" className="input" defaultValue="lingua-portuguesa">
              <option value="todas">Todas</option>{SUBJECTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
          <div className="field"><label htmlFor="grade">Série (define a dificuldade)</label>
            <select id="grade" name="grade" className="input" defaultValue={cls?.grade ?? "9"}>{GRADES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}</select></div>
          <div className="field"><label htmlFor="count">Quantas questões</label><input id="count" name="count" type="number" min={1} max={60} defaultValue={10} className="input" /></div>
          <div className="field"><label htmlFor="classId">Turma (opcional)</label>
            <select id="classId" name="classId" className="input" defaultValue={sp.turma ?? ""}><option value="">Sem turma</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        </div>
        <details className="fold mb-3"><summary>Mais opções</summary>
          <Field label="Título da prova" name="title" placeholder="Gerado a partir dos temas" />
          <div className="field"><label htmlFor="dificuldade">Dificuldade</label>
            <select id="dificuldade" name="dificuldade" className="input" defaultValue="0"><option value="0">Automática pela série</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} de 5</option>)}</select></div>
          <fieldset className="field"><legend>Bancas (vazio = todas)</legend>
            <div className="flex flex-wrap gap-3">{BANCAS.map((b) => <label key={b} className="flex gap-1.5 font-normal"><input type="checkbox" name="inst" value={b} />{b}</label>)}</div></fieldset>
        </details>
        <SubmitButton pendingLabel="Pesquisando no banco…">Montar prova</SubmitButton>
        <p className="hint mt-3">Prefere partir do que você ensinou? <Link href="/app/provas/nova">Criar a partir do conteúdo estudado</Link>.</p>
      </Form>
    </div>
  );
}
