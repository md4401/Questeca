"use client";
import { useState, useTransition } from "react";
import { previewStudents, commitStudents, type StudentRow } from "@/app/app/turmas/actions";

export function StudentImport({ classId }: { classId: string }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<StudentRow[] | null>(null);
  const [msg, setMsg] = useState<{ err?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  const preview = () => start(async () => {
    setMsg(null);
    const r = await previewStudents(classId, text);
    if ("error" in r) { setMsg({ err: r.error }); setRows(null); } else setRows(r.rows);
  });
  const commit = () => start(async () => {
    const chosen = (rows ?? []).filter((r) => r.include);
    const r = await commitStudents(classId, chosen.map((c) => ({ name: c.name, registration: c.registration })));
    if ("error" in r) setMsg({ err: r.error }); else { setMsg({ ok: r.ok }); setRows(null); setText(""); }
  });
  const badge = (s: StudentRow["status"]) => s === "novo" ? <span className="badge">novo</span> : s === "repetido" ? <span className="badge badge-gray">repetido</span> : s === "homonimo" ? <span className="badge badge-amber">homônimo</span> : <span className="badge badge-danger">erro</span>;

  return (
    <div className="card">
      <h2 className="mb-1 text-lg">Adicionar vários alunos</h2>
      <p className="hint mb-2">Cole uma lista (um por linha; opcionalmente “Nome;matrícula”) ou direto de uma planilha. Nada é gravado antes da prévia.</p>
      <label htmlFor="list" className="label">Lista de alunos</label>
      <textarea id="list" className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={"Maria Silva;2024001\nJoão Souza;2024002"} />
      <div className="mt-2 flex gap-2"><button type="button" className="btn btn-sm" onClick={preview} disabled={pending || !text.trim()}>Ver prévia</button></div>
      <div aria-live="polite">{msg?.err && <p className="err mt-2" role="alert">{msg.err}</p>}{msg?.ok && <p className="ok mt-2">{msg.ok}</p>}</div>
      {rows && (
        <div className="mt-4 overflow-x-auto">
          <table className="t"><thead><tr><th>Incluir</th><th>Linha</th><th>Nome</th><th>Matrícula</th><th>Situação</th></tr></thead><tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td><input aria-label={`Incluir ${r.name}`} type="checkbox" checked={r.include} disabled={r.status === "erro" || r.status === "repetido"} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} /></td>
                <td>{r.line}</td><td>{r.name}</td><td>{r.registration ?? "—"}</td><td>{badge(r.status)} <span className="hint">{r.message}</span></td>
              </tr>))}
          </tbody></table>
          <p className="mt-2 text-sm">{rows.filter((r) => r.include).length} de {rows.length} linha(s) serão adicionadas. Homônimos só entram se você marcar que são outra pessoa.</p>
          <button type="button" className="btn mt-2" onClick={commit} disabled={pending || !rows.some((r) => r.include)}>Adicionar selecionados</button>
        </div>
      )}
    </div>
  );
}
