"use client";
import { useState, useTransition } from "react";
import { parseSheetFile, previewGradeImport, commitGradeImport, type SheetData, type ImportLine } from "@/app/app/turmas/import-actions";

export function GradeImport({ classId, items }: { classId: string; items: { id: string; title: string }[] }) {
  const [sheet, setSheet] = useState<SheetData | null>(null);
  const [keyCol, setKeyCol] = useState(0);
  const [keyKind, setKeyKind] = useState<"registration" | "name">("registration");
  const [valueCol, setValueCol] = useState(1);
  const [pickedItem, setItemId] = useState("");
  const itemId = items.find((i) => i.id === pickedItem)?.id ?? items[0]?.id ?? "";
  const [lines, setLines] = useState<ImportLine[] | null>(null);
  const [msg, setMsg] = useState<{ err?: string; ok?: string } | null>(null);
  const [pending, start] = useTransition();

  const upload = (fd: FormData) => start(async () => {
    setMsg(null); setLines(null);
    const r = await parseSheetFile(fd);
    if ("error" in r) { setMsg({ err: r.error }); setSheet(null); return; }
    setSheet(r);
    setKeyCol(0); setValueCol(Math.min(1, r.headers.length - 1));
  });
  const preview = () => start(async () => {
    if (!sheet) return;
    const r = await previewGradeImport(classId, itemId, { keyCol, keyKind, valueCol }, sheet.rows);
    if ("error" in r) setMsg({ err: r.error }); else { setMsg(null); setLines(r.lines); }
  });
  const commit = () => start(async () => {
    const picks = (lines ?? []).filter((l) => l.include && l.studentId).map((l) => ({ studentId: l.studentId!, raw: l.raw }));
    const r = await commitGradeImport(classId, itemId, picks);
    setMsg(r.errors.length ? { err: `${r.ok} salvas; ${r.errors.length} com erro.` } : { ok: `${r.ok} nota(s) importada(s).` });
    setLines(null); setSheet(null);
  });
  const badge = (s: ImportLine["status"]) => ({ novo: <span key="n" className="badge">novo</span>, atualizacao: <span key="a" className="badge badge-amber">atualização</span>, igual: <span key="i" className="badge badge-gray">igual</span>, vazio: <span key="v" className="badge badge-gray">vazio</span>, erro: <span key="e" className="badge badge-danger">erro</span> })[s];

  if (!items.length) return <p className="hint">Crie uma atividade neste período para importar notas.</p>;
  return (
    <div>
      <form action={upload} className="flex flex-wrap items-end gap-3">
        <div className="field mb-0"><label htmlFor="gfile">Arquivo (.csv ou .xlsx)</label><input id="gfile" name="file" type="file" accept=".csv,.xlsx,.txt,.tsv" className="input" /></div>
        <button className="btn btn-sm" disabled={pending}>Ler arquivo</button>
      </form>
      <div aria-live="polite">{msg?.err && <p className="err mt-2" role="alert">{msg.err}</p>}{msg?.ok && <p className="ok mt-2">{msg.ok}</p>}</div>
      {sheet && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">{sheet.rows.length} linha(s) lidas. Mapeie as colunas:</p>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="field mb-0"><label htmlFor="kc">Coluna que identifica o aluno</label><select id="kc" className="input" value={keyCol} onChange={(e) => setKeyCol(Number(e.target.value))}>{sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}</select></div>
            <div className="field mb-0"><label htmlFor="kk">Identificar por</label><select id="kk" className="input" value={keyKind} onChange={(e) => setKeyKind(e.target.value as "registration" | "name")}><option value="registration">Matrícula</option><option value="name">Nome</option></select></div>
            <div className="field mb-0"><label htmlFor="vc">Coluna da nota</label><select id="vc" className="input" value={valueCol} onChange={(e) => setValueCol(Number(e.target.value))}>{sheet.headers.map((h, i) => <option key={i} value={i}>{h || `Coluna ${i + 1}`}</option>)}</select></div>
            <div className="field mb-0"><label htmlFor="it">Atividade de destino</label><select id="it" className="input" value={itemId} onChange={(e) => setItemId(e.target.value)}>{items.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}</select></div>
          </div>
          <button type="button" className="btn btn-sm" onClick={preview} disabled={pending}>Ver prévia</button>
        </div>
      )}
      {lines && (
        <div className="mt-4 overflow-x-auto">
          <p className="mb-2 text-sm">Novos: {lines.filter((l) => l.status === "novo").length} · Atualizações: {lines.filter((l) => l.status === "atualizacao").length} · Vazios: {lines.filter((l) => l.status === "vazio").length} · Erros: {lines.filter((l) => l.status === "erro").length}</p>
          <table className="t"><thead><tr><th>Salvar</th><th>Linha</th><th>Aluno</th><th>Valor</th><th>Situação</th></tr></thead><tbody>
            {lines.map((l, i) => (
              <tr key={i}><td><input type="checkbox" aria-label={`Salvar ${l.label}`} checked={l.include} disabled={l.status === "erro" || l.status === "vazio" || l.status === "igual"} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))} /></td>
                <td>{l.line}</td><td>{l.label}</td><td>{l.raw || "—"}</td><td>{badge(l.status)} <span className="hint">{l.message}</span></td></tr>))}
          </tbody></table>
          <button type="button" className="btn mt-3" onClick={commit} disabled={pending || !lines.some((l) => l.include)}>Salvar somente linhas válidas ({lines.filter((l) => l.include).length})</button>
        </div>
      )}
    </div>
  );
}
