"use client";
import { useState } from "react";
import type { TaskQuestion } from "@/db/schema";

/** Monta questões da tarefa (múltipla escolha com correção automática, ou discursiva). Vai ao servidor como JSON no campo "questions". */
export function QuestionBuilder({ initial = [], name = "questions" }: { initial?: TaskQuestion[]; name?: string }) {
  const [qs, setQs] = useState<TaskQuestion[]>(initial);
  const upd = (i: number, p: Partial<TaskQuestion>) => setQs(qs.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const add = (type: "mc" | "text") => setQs([...qs, { id: `q${Date.now().toString(36)}`, type, prompt: "", options: type === "mc" ? ["", ""] : undefined, answer: type === "mc" ? 0 : undefined, points: 1 }]);
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-semibold">Questões (opcional)</legend>
      <input type="hidden" name={name} value={JSON.stringify(qs)} />
      {qs.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-line bg-white p-3">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">Questão {i + 1} · {q.type === "mc" ? "múltipla escolha" : "discursiva"}</p>
            <button type="button" className="link-btn text-danger" onClick={() => setQs(qs.filter((_, k) => k !== i))}>Remover</button></div>
          <div className="field mt-2"><label htmlFor={`${q.id}-p`}>Enunciado</label><textarea id={`${q.id}-p`} className="input" value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} /></div>
          {q.type === "mc" && (
            <div className="space-y-2">
              {(q.options ?? []).map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input type="radio" name={`${q.id}-ans`} checked={q.answer === k} onChange={() => upd(i, { answer: k })} aria-label={`Alternativa ${String.fromCharCode(65 + k)} é a correta`} />
                  <input className="input flex-1" value={o} placeholder={`Alternativa ${String.fromCharCode(65 + k)}`} aria-label={`Texto da alternativa ${String.fromCharCode(65 + k)} da questão ${i + 1}`} onChange={(e) => upd(i, { options: (q.options ?? []).map((x, j) => (j === k ? e.target.value : x)) })} />
                </div>))}
              {(q.options ?? []).length < 6 && <button type="button" className="link-btn" onClick={() => upd(i, { options: [...(q.options ?? []), ""] })}>+ alternativa</button>}
            </div>)}
          <div className="field mt-2 max-w-[10rem]"><label htmlFor={`${q.id}-pts`}>Pontos</label><input id={`${q.id}-pts`} className="input" inputMode="decimal" value={String(q.points).replace(".", ",")} onChange={(e) => upd(i, { points: Number(e.target.value.replace(",", ".")) || 0 })} /></div>
        </div>))}
      <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost btn-sm" onClick={() => add("mc")}>+ Múltipla escolha</button><button type="button" className="btn btn-ghost btn-sm" onClick={() => add("text")}>+ Discursiva</button></div>
    </fieldset>
  );
}
