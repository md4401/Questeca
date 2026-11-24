"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { fromHtml, toHtml } from "@/lib/core/richtext";
import { useRouter } from "next/navigation";
import { saveExamEditsAction, addBlankQuestionAction, type EditPayload } from "@/app/app/provas/[id]/editar/actions";
import { moveAction, removeItemAction } from "@/app/app/provas/actions";

type Item = { itemId: string; number: number; points: string; statement: string; alternatives: { key: string; text: string }[]; origStatement: string; origAlternatives: { key: string; text: string }[]; edited: boolean; ia?: { answer: string } | null; tema?: string | null };
type Block = { id: string; beforeItemId: string | null; text: string };
type Props = { assessmentId: string; title: string; instructions: string | null; items: Item[]; blocks: Block[]; schoolName: string };

function Editable({ html, label, field, onDirty, className = "", single }: { html: string; label: string; field: string; onDirty: () => void; className?: string; single?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current && ref.current.innerHTML !== html) ref.current.innerHTML = html; }, [html]);
  return (
    <div ref={ref} role="textbox" aria-multiline={!single} aria-label={label} data-field={field} contentEditable suppressContentEditableWarning spellCheck lang="pt-BR"
      className={`editable ${className}`} onInput={onDirty}
      onKeyDown={(e) => { if (single && e.key === "Enter") e.preventDefault(); }}
      onPaste={(e) => { e.preventDefault(); const t = e.clipboardData.getData("text/plain"); document.execCommand("insertText", false, single ? t.replace(/\s*\n\s*/g, " ") : t); }} />
  );
}

/** Editor de texto da prova (como no Word): negrito, itálico, sublinhado, blocos de texto e restauração do original. */
export function ExamEditor({ assessmentId, title, instructions, items: initItems, blocks: initBlocks, schoolName }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initItems);
  const [blankAnswer, setBlankAnswer] = useState("A");
  const root = useRef<HTMLDivElement>(null);
  const [blocks, setBlocks] = useState<Block[]>(initBlocks);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "saving" | "saved" | "error"; text: string }>({ kind: "idle", text: "Sem alterações." });
  const [restored, setRestored] = useState<Record<string, number>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef(false);

  const markDirty = useCallback(() => { setDirty(true); setStatus({ kind: "idle", text: "Alterações não salvas." }); }, []);
  const collect = useCallback((): EditPayload => {
    const q = (f: string) => fromHtml(root.current!.querySelector<HTMLElement>(`[data-field="${f}"]`)?.innerHTML ?? "");
    return {
      title: (root.current!.querySelector<HTMLInputElement>("#exam-title")?.value ?? title),
      instructions: root.current!.querySelector('[data-field="instructions"]') ? q("instructions") : null,
      items: items.map((it) => ({ itemId: it.itemId, statement: q(`st:${it.itemId}`), alternatives: it.alternatives.map((a) => ({ key: a.key, text: q(`alt:${it.itemId}:${a.key}`) })) })),
      blocks: blocks.map((b) => ({ id: b.id, beforeItemId: b.beforeItemId, text: q(`blk:${b.id}`) })),
    };
  }, [items, blocks, title]);

  const save = useCallback(async () => {
    if (saving.current) return; saving.current = true;
    setStatus({ kind: "saving", text: "Salvando…" });
    try {
      const r = await saveExamEditsAction(assessmentId, collect());
      if (r.ok) { setDirty(false); setStatus({ kind: "saved", text: `Salvo às ${new Date(r.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.` }); }
      else setStatus({ kind: "error", text: r.error });
    } catch { setStatus({ kind: "error", text: "Não consegui salvar. Verifique a conexão e tente de novo." }); }
    saving.current = false;
  }, [assessmentId, collect]);

  // salvamento automático 3 s depois da última alteração
  useEffect(() => { if (!dirty) return; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void save(), 3000); return () => { if (timer.current) clearTimeout(timer.current); }; }, [dirty, save, status.text]);
  useEffect(() => { const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } }; window.addEventListener("beforeunload", h); return () => window.removeEventListener("beforeunload", h); }, [dirty]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [save]);

  /** Salva o texto e então executa uma ação estrutural (mover, remover, adicionar); a página recarrega com a nova estrutura. */
  const structural = async (fn: () => Promise<unknown>) => {
    await save();
    setStatus({ kind: "saving", text: "Atualizando a prova…" });
    try { const r = (await fn()) as { ok?: boolean; error?: string } | undefined; if (r && r.ok === false) { setStatus({ kind: "error", text: r.error ?? "Não foi possível." }); return; } router.refresh(); } catch { setStatus({ kind: "error", text: "Não foi possível atualizar a prova." }); }
  };
  const cmd = (c: string) => { document.execCommand("styleWithCSS", false, "false"); document.execCommand(c); markDirty(); };
  const Btn = ({ c, label, children }: { c: string; label: string; children: React.ReactNode }) => (
    <button type="button" className="tb-btn" aria-label={label} title={label} onMouseDown={(e) => e.preventDefault()} onClick={() => cmd(c)}>{children}</button>);

  const addBlock = (beforeItemId: string | null) => { const id = `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; setBlocks((b) => [...b, { id, beforeItemId, text: "" }]); markDirty(); setTimeout(() => root.current?.querySelector<HTMLElement>(`[data-field="blk:${id}"]`)?.focus(), 50); };
  const delBlock = (id: string) => { setBlocks((b) => b.filter((x) => x.id !== id)); markDirty(); };
  const restore = (it: Item) => {
    setItems((all) => all.map((x) => (x.itemId === it.itemId ? { ...x, statement: it.origStatement, alternatives: it.origAlternatives, edited: false } : x)));
    setRestored((r) => ({ ...r, [it.itemId]: (r[it.itemId] ?? 0) + 1 })); markDirty();
  };
  const blocksAt = (id: string | null) => blocks.filter((b) => b.beforeItemId === id);
  const blockView = (b: Block) => (
    <div className="mb-3 rounded-md border border-dashed border-[#9AA7C7] p-2">
      <div className="mb-1 flex items-center justify-between text-xs text-[#555]"><span>Bloco de texto</span><button type="button" className="link-btn !text-[#B42318]" onClick={() => delBlock(b.id)} aria-label="Remover bloco de texto">Remover bloco</button></div>
      <Editable html={toHtml(b.text)} label="Bloco de texto" field={`blk:${b.id}`} onDirty={markDirty} className="min-h-[2.5rem]" />
    </div>);

  return (
    <div ref={root}>
      <div className="exam-toolbar no-print" role="toolbar" aria-label="Formatação do texto">
        <Btn c="bold" label="Negrito (Ctrl+B)"><b>N</b></Btn>
        <Btn c="italic" label="Itálico (Ctrl+I)"><i>I</i></Btn>
        <Btn c="underline" label="Sublinhado (Ctrl+U)"><u>S</u></Btn>
        <span className="tb-sep" aria-hidden />
        <Btn c="undo" label="Desfazer (Ctrl+Z)">↶</Btn>
        <Btn c="redo" label="Refazer (Ctrl+Y)">↷</Btn>
        <span className="tb-sep" aria-hidden />
        <button type="button" className="tb-btn !w-auto px-3" onClick={() => addBlock(null)}>+ Texto no final</button>
        <a className="tb-btn !w-auto px-3" href={`/app/banco?add=${assessmentId}`}>+ Questão do banco</a>
        <span className="flex items-center gap-1"><button type="button" className="tb-btn !w-auto px-3" onClick={() => void structural(() => addBlankQuestionAction(assessmentId, blankAnswer))}>+ Questão nova</button>
          <label className="sr-only" htmlFor="blank-ans">Alternativa correta da questão nova</label>
          <select id="blank-ans" className="input !w-auto !py-0.5 text-xs" value={blankAnswer} onChange={(e) => setBlankAnswer(e.target.value)} title="Alternativa correta">{["A", "B", "C", "D", "E"].map((k) => <option key={k} value={k}>Gab. {k}</option>)}</select></span>
        <span className="ml-auto flex items-center gap-3">
          <span role="status" aria-live="polite" className={`text-sm ${status.kind === "error" ? "text-danger" : "text-ink-soft"}`}>{status.text}</span>
          <button type="button" className="btn btn-sm" disabled={!dirty || status.kind === "saving"} onClick={() => void save()}>Salvar</button>
        </span>
      </div>
      <p className="hint mb-3 no-print">As alterações valem só para esta prova e não mudam o banco de questões. A resposta do gabarito e as letras das alternativas não mudam. Ao baixar o PDF ou o Word, a prova sai com o seu texto.</p>

      <article className="paper" aria-label="Prova editável">
        <header className="mb-4 border-b border-[#ccc] pb-3">
          <p className="text-sm font-bold" style={{ fontFamily: "var(--font-sans)" }}>{schoolName || "Escola"}</p>
          <label htmlFor="exam-title" className="sr-only">Título da prova</label>
          <input id="exam-title" defaultValue={title} onInput={markDirty} className="paper-title" />
          <Editable html={toHtml(instructions ?? "")} label="Instruções da prova" field="instructions" onDirty={markDirty} className="paper-instructions" />
        </header>
        {items.map((it) => (
          <section key={it.itemId} aria-label={`Questão ${it.number}`} className="mb-5">
            {blocksAt(it.itemId).map((b) => <div key={b.id}>{blockView(b)}</div>)}
            <div className="flex gap-2">
              <span className="font-bold">{it.number}.</span>
              <div className="min-w-0 flex-1" key={`${it.itemId}-${restored[it.itemId] ?? 0}`}>
                <Editable html={toHtml(it.statement)} label={`Enunciado da questão ${it.number}`} field={`st:${it.itemId}`} onDirty={markDirty} />
                <ol className="mt-1 space-y-0.5">{it.alternatives.map((a) => (
                  <li key={a.key} className="flex gap-1.5 pl-3"><span className="font-semibold">{a.key})</span>
                    <Editable html={toHtml(a.text)} label={`Alternativa ${a.key} da questão ${it.number}`} field={`alt:${it.itemId}:${a.key}`} onDirty={markDirty} className="flex-1" single /></li>))}</ol>
              </div>
              <span className="whitespace-nowrap text-xs text-[#555]">({it.points} pt)</span>
            </div>
            <div className="no-print mt-1 flex gap-3 pl-6 text-xs">
              <button type="button" className="link-btn" onClick={() => addBlock(it.itemId)} aria-label={`Inserir texto antes da questão ${it.number}`}>Inserir texto antes</button>
              <button type="button" className="link-btn" onClick={() => restore(it)} aria-label={`Restaurar original da questão ${it.number}`}>Restaurar original</button>
              <button type="button" className="link-btn" disabled={it.number === 1} onClick={() => void structural(() => moveAction(assessmentId, it.itemId, "up"))} aria-label={`Subir a questão ${it.number}`}>↑ Subir</button>
              <button type="button" className="link-btn" disabled={it.number === items.length} onClick={() => void structural(() => moveAction(assessmentId, it.itemId, "down"))} aria-label={`Descer a questão ${it.number}`}>↓ Descer</button>
              <button type="button" className="link-btn !text-[#B42318]" onClick={() => { if (confirm(`Remover a questão ${it.number} da prova?`)) void structural(() => removeItemAction(assessmentId, it.itemId)); }} aria-label={`Remover a questão ${it.number}`}>Remover</button>
              {it.edited && <span className="text-[#8A5300]">editada</span>}
              {it.ia && <span className="rounded bg-[#FFF1C2] px-1.5 py-0.5 text-[#6B4300]" data-testid="badge-ia">Criada por IA · gabarito {it.ia.answer} · confira antes de aplicar</span>}
              {!it.ia && it.tema && <span className="text-[#555]">Tema: {it.tema}</span>}
            </div>
          </section>))}
        {blocksAt(null).map((b) => <div key={b.id}>{blockView(b)}</div>)}
      </article>
    </div>
  );
}
