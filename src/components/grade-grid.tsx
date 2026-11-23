"use client";
import { useRef, useState, useTransition } from "react";
import { saveGrade, saveGradesBatch, averagesFor } from "@/app/app/turmas/actions";

type Item = { id: string; title: string; weight: number; maxPoints: number; recovery: boolean };
type Row = { studentId: string; name: string; cells: Record<string, string>; average: number | null; partial: boolean; formula: string };

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }));

export function GradeGrid({ classId, period, items, rows: initial, closed, passMark }: { classId: string; period: string; items: Item[]; rows: Row[]; closed: boolean; passMark: number }) {
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  const [, start] = useTransition();
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const k = (r: number, c: number) => `${r}:${c}`;

  const refresh = async () => {
    const avgs = await averagesFor(classId, period);
    setRows((prev) => prev.map((r) => { const a = avgs.find((x) => x.studentId === r.studentId); return a ? { ...r, average: a.average, partial: a.partial, formula: a.formula } : r; }));
  };

  const commit = (ri: number, ci: number, value: string) => {
    const row = rows[ri]; const item = items[ci];
    if ((row.cells[item.id] ?? "") === value.trim()) return;
    start(async () => {
      const res = await saveGrade(classId, item.id, row.studentId, value);
      const key = `${row.studentId}:${item.id}`;
      if ("error" in res && res.error) { setErrors((e) => ({ ...e, [key]: res.error! })); return; }
      setErrors((e) => { const { [key]: _drop, ...rest } = e; return rest; });
      setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, cells: { ...r.cells, [item.id]: value.trim() } } : r)));
      setSaved("Salvo");
      await refresh();
    });
  };

  const onPaste = (e: React.ClipboardEvent, ri: number, ci: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim())) return; // célula única: comportamento normal
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1);
    const entries: { itemId: string; studentId: string; raw: string }[] = [];
    const next = rows.map((r) => ({ ...r, cells: { ...r.cells } }));
    lines.forEach((line, dr) => line.split("\t").forEach((raw, dc) => {
      const r = next[ri + dr]; const it = items[ci + dc];
      if (!r || !it) return;
      entries.push({ itemId: it.id, studentId: r.studentId, raw }); r.cells[it.id] = raw.trim();
    }));
    setRows(next);
    start(async () => {
      const res = await saveGradesBatch(classId, entries);
      const errs: Record<string, string> = {};
      res.forEach((x) => { if (x.error) errs[`${x.studentId}:${x.itemId}`] = x.error; });
      setErrors(errs);
      setSaved(res.some((x) => x.error) ? "Alguns valores não foram salvos" : "Salvo");
      await refresh();
    });
  };

  const move = (e: React.KeyboardEvent, ri: number, ci: number) => {
    const t = (r: number, c: number) => refs.current[k(r, c)]?.focus();
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); t(ri + 1, ci); }
    else if (e.key === "ArrowUp") { e.preventDefault(); t(ri - 1, ci); }
    else if (e.key === "ArrowRight" && (e.currentTarget as HTMLInputElement).selectionStart === (e.currentTarget as HTMLInputElement).value.length) { e.preventDefault(); t(ri, ci + 1); }
    else if (e.key === "ArrowLeft" && (e.currentTarget as HTMLInputElement).selectionStart === 0) { e.preventDefault(); t(ri, ci - 1); }
  };

  if (!rows.length) return <p className="text-ink-soft">Cadastre alunos para lançar notas.</p>;
  if (!items.length) return <p className="text-ink-soft">Crie a primeira atividade deste período para começar a lançar.</p>;
  return (
    <div>
      <p className="hint mb-2" aria-live="polite">Use Enter/setas para navegar, cole várias células da planilha, digite <strong>F</strong> (ausente), <strong>N</strong> (não entregue) ou deixe vazio (pendente). {saved && <span className="ok">· {saved}</span>}</p>
      <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight: "70vh" }}>
        <table className="t">
          <thead className="sticky top-0 z-10"><tr>
            <th className="sticky left-0 z-20 min-w-48 bg-brand-tint">Aluno</th>
            {items.map((i) => <th key={i.id} className="min-w-28">{i.title}<div className="font-normal text-xs">peso {i.weight} · máx {i.maxPoints}{i.recovery ? " · rec." : ""}</div></th>)}
            <th className="min-w-28">Média</th>
          </tr></thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={r.studentId}>
                <th scope="row" className="sticky left-0 bg-white font-medium">{r.name}</th>
                {items.map((it, ci) => {
                  const key = `${r.studentId}:${it.id}`;
                  return (
                    <td key={it.id}>
                      <input
                        ref={(el) => { refs.current[k(ri, ci)] = el; }}
                        aria-label={`${r.name} — ${it.title}`} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `err-${key}` : undefined}
                        className={`input ${errors[key] ? "border-danger" : ""}`} style={{ minHeight: 34, padding: ".25rem .5rem", width: 90 }}
                        defaultValue={r.cells[it.id] ?? ""} disabled={closed} inputMode="decimal"
                        onBlur={(e) => commit(ri, ci, e.target.value)} onKeyDown={(e) => move(e, ri, ci)} onPaste={(e) => onPaste(e, ri, ci)}
                      />
                      {errors[key] && <span id={`err-${key}`} role="alert" className="err block text-xs">{errors[key]}</span>}
                    </td>
                  );
                })}
                <td title={r.formula} className={r.average != null && r.average < passMark ? "font-bold text-danger" : "font-bold"}>
                  {fmt(r.average)} {r.partial && r.average != null && <span className="badge badge-amber">parcial</span>}
                  {r.formula && <div className="hint font-normal">{r.formula}</div>}
                </td>
              </tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
