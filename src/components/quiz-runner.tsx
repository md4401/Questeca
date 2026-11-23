"use client";
import { useEffect, useRef, useState } from "react";
import { Form, SubmitButton } from "@/components/form";
import { submitQuizAction } from "@/app/portal/quizzes/actions";
import type { QuizItem } from "@/db/schema";

type PublicItem = Pick<QuizItem, "id" | "type" | "prompt" | "options" | "points">;

/** Responder o quiz com contagem regressiva (o servidor é quem decide se o envio ainda vale). Envia sozinho ao zerar. */
export function QuizRunner({ attemptId, items, deadlineMs }: { attemptId: string; items: PublicItem[]; deadlineMs: number | null }) {
  const [left, setLeft] = useState<number | null>(deadlineMs ? Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)) : null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!deadlineMs) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadlineMs - Date.now()) / 1000)); setLeft(s);
      if (s === 0) { clearInterval(t); ref.current?.querySelector("form")?.requestSubmit(); }
    }, 1000);
    return () => clearInterval(t);
  }, [deadlineMs]);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  return (
    <div ref={ref} className="space-y-3">
      {left !== null && <p className="sticky top-14 z-10 rounded-xl bg-white/95 px-3 py-2 text-sm font-semibold shadow md:top-16" role="timer" aria-live="off">Tempo restante: <span className={left < 60 ? "text-danger" : ""}>{fmt(left)}</span></p>}
      <Form action={submitQuizAction.bind(null, attemptId)} toast>
        {items.map((it, i) => (
          <fieldset key={it.id} className="field card"><legend className="px-1 font-semibold">{i + 1}. {it.prompt} <span className="hint">({String(it.points).replace(".", ",")} pt)</span></legend>
            {it.type === "mc" && (it.options ?? []).map((o, k) => <label key={k} className="flex items-center gap-2 py-1 font-normal"><input type="radio" name={`q_${it.id}`} value={k} />{String.fromCharCode(65 + k)}) {o}</label>)}
            {it.type === "tf" && <><label className="flex items-center gap-2 py-1 font-normal"><input type="radio" name={`q_${it.id}`} value="true" />Verdadeiro</label><label className="flex items-center gap-2 py-1 font-normal"><input type="radio" name={`q_${it.id}`} value="false" />Falso</label></>}
            {(it.type === "challenge") && <input className="input" name={`q_${it.id}`} aria-label={`Resposta da questão ${i + 1}`} autoComplete="off" />}
            {it.type === "text" && <textarea className="input" name={`q_${it.id}`} aria-label={`Resposta da questão ${i + 1}`} />}
          </fieldset>))}
        <SubmitButton pendingLabel="Enviando…">Enviar respostas</SubmitButton>
      </Form>
    </div>
  );
}
