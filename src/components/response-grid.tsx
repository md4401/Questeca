"use client";
import { useRef, useState, useTransition } from "react";
import { saveResponse, saveResponsesBatch, setPresence } from "@/app/app/provas/correcao-actions";

type Item = { position: number; key: string; points: number; rubric?: { name: string; points: number }[] };
type Row = { studentId: string; name: string; absent: boolean; cells: Record<number, string>; total: number; complete: boolean };

export function ResponseGrid({ appId, items, rows: initial }: { appId: string; items: Item[]; rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState("");
  const [, start] = useTransition();
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const sumFor = (r: Row) => r.total;

  const commit = (ri: number, it: Item, v: string) => {
    const row = rows[ri];
    if ((row.cells[it.position] ?? "") === v.trim().toUpperCase()) return;
    start(async () => {
      const res = await saveResponse(appId, row.studentId, it.position, v);
      const k = `${row.studentId}:${it.position}`;
      if ("error" in res && res.error) { setErrors((e) => ({ ...e, [k]: res.error! })); return; }
      setErrors((e) => { const { [k]: _d, ...rest } = e; return rest; });
      setState("Salvo");
      setRows((prev) => prev.map((r, i) => {
        if (i !== ri) return r;
        const cells = { ...r.cells, [it.position]: v.trim() === "" ? (it.key === "D" ? "" : "-") : v.trim().toUpperCase().replace(",", ".") };
        return { ...r, absent: false, cells, total: recompute(cells), complete: items.every((x) => (cells[x.position] ?? "") !== "") };
      }));
    });
  };
  const recompute = (cells: Record<number, string>) => Math.round(items.reduce((a, it) => {
    const v = cells[it.position];
    if (!v || v === "-") return a;
    if (it.key === "D") return a + Math.min(Number(v) || 0, it.points);
    return a + (v === it.key ? it.points : 0);
  }, 0) * 100) / 100;

  const move = (e: React.KeyboardEvent, ri: number, ci: number) => {
    const t = (r: number, c: number) => refs.current[`${r}:${c}`]?.focus();
    if (e.key === "Enter" || e.key === "ArrowDown") { e.preventDefault(); t(ri + 1, ci); }
    else if (e.key === "ArrowUp") { e.preventDefault(); t(ri - 1, ci); }
    else if (e.key === "ArrowRight") { e.preventDefault(); t(ri, ci + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); t(ri, ci - 1); }
  };

  const onPaste = (e: React.ClipboardEvent, ri: number, ci: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text.trim()) && text.trim().length <= 1) return;
    e.preventDefault();
    const entries: { studentId: string; position: number; raw: string }[] = [];
    const next = rows.map((r) => ({ ...r, cells: { ...r.cells } }));
    text.replace(/\r/g, "").split("\n").filter((l, i, a) => l !== "" || i < a.length - 1).forEach((line, dr) => {
      const parts = line.includes("\t") ? line.split("\t") : line.trim().length > 1 && !line.includes(" ") ? line.trim().split("") : line.split(/[\s,;]+/);
      parts.forEach((raw, dc) => {
        const r = next[ri + dr]; const it = items[ci + dc]; if (!r || !it) return;
        entries.push({ studentId: r.studentId, position: it.position, raw }); r.cells[it.position] = raw.trim().toUpperCase() || "-";
      });
    });
    next.forEach((r) => { r.total = recompute(r.cells); r.complete = items.every((x) => (r.cells[x.position] ?? "") !== ""); });
    setRows(next);
    start(async () => {
      const res = await saveResponsesBatch(appId, entries);
      const errs: Record<string, string> = {}; res.forEach((x) => { if (x.error) errs[`${x.studentId}:${x.position}`] = x.error; });
      setErrors(errs); setState(res.some((x) => x.error) ? "Alguns valores foram rejeitados" : "Salvo");
    });
  };

  const toggleAbsent = (ri: number, absent: boolean) => {
    start(async () => {
      await setPresence(appId, rows[ri].studentId, absent);
      setRows((prev) => prev.map((r, i) => (i === ri ? { ...r, absent, cells: absent ? {} : r.cells, total: absent ? 0 : r.total, complete: absent ? false : r.complete } : r)));
    });
  };

  if (!rows.length) return <p className="text-ink-soft">Cadastre os alunos da turma para registrar respostas.</p>;
  return (
    <div>
      <p className="hint mb-2" aria-live="polite">Digite a letra marcada (A–E), <strong>-</strong> para em branco. Cole uma linha de respostas (ex.: ABCDE) ou várias células. Marque “Ausente” para quem faltou. {state && <span className="ok">· {state}</span>}</p>
      <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight: "65vh" }}>
        <table className="t">
          <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 z-20 min-w-44 bg-brand-tint">Aluno</th><th>Ausente</th>
            {items.map((it) => <th key={it.position} title={it.rubric ? it.rubric.map((c) => `${c.name}: ${c.points}`).join(" · ") : `Gabarito ${it.key}`}>Q{it.position}<div className="text-xs font-normal">{it.key === "D" ? `0–${it.points}` : `${it.points} pt`}</div></th>)}
            <th>Total</th></tr></thead>
          <tbody>{rows.map((r, ri) => (
            <tr key={r.studentId} className={r.absent ? "opacity-60" : ""}>
              <th scope="row" className="sticky left-0 bg-white font-medium">{r.name}{!r.complete && !r.absent && <span className="badge badge-amber ml-2">pendente</span>}</th>
              <td><input type="checkbox" aria-label={`${r.name} ausente`} checked={r.absent} onChange={(e) => toggleAbsent(ri, e.target.checked)} /></td>
              {items.map((it, ci) => {
                const k = `${r.studentId}:${it.position}`;
                const v = r.cells[it.position] ?? "";
                const ok = it.key !== "D" && v && v !== "-" && v === it.key;
                const wrong = it.key !== "D" && v && v !== "-" && v !== it.key;
                return (
                  <td key={it.position}>
                    <input ref={(el) => { refs.current[`${ri}:${ci}`] = el; }} aria-label={`${r.name} — questão ${it.position}`} aria-invalid={!!errors[k]}
                      className={`input text-center uppercase ${ok ? "bg-brand-tint" : wrong ? "bg-danger-tint" : ""}`} style={{ width: it.key === "D" ? 64 : 48, minHeight: 34, padding: ".2rem" }}
                      defaultValue={v} disabled={r.absent} maxLength={it.key === "D" ? 5 : 1}
                      onBlur={(e) => commit(ri, it, e.target.value)} onKeyDown={(e) => move(e, ri, ci)} onPaste={(e) => onPaste(e, ri, ci)}
                      onInput={(e) => { if (it.key !== "D" && e.currentTarget.value.length === 1) refs.current[`${ri + 1}:${ci}`]?.focus(); }} />
                    {errors[k] && <span role="alert" className="err block text-xs">{errors[k]}</span>}
                  </td>);
              })}
              <td className="font-bold">{r.absent ? "F" : sumFor(r).toLocaleString("pt-BR")}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
