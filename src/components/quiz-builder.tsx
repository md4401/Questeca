"use client";
import { useState, useTransition } from "react";
import type { QuizItem } from "@/db/schema";
import { suggestQuizAction } from "@/app/app/turmas/[id]/quizzes/actions";

const TYPE: Record<QuizItem["type"], string> = { mc: "Múltipla escolha", tf: "Verdadeiro ou falso", challenge: "Desafio (resposta curta)", text: "Discursiva (correção do professor)" };

/** Monta o quiz e envia JSON em "items". Questões sugeridas por IA ficam marcadas e exigem revisão do professor. */
export function QuizBuilder({ initial = [], aiOn, aiGenerated = false, reviewed = true }: { initial?: QuizItem[]; aiOn: boolean; aiGenerated?: boolean; reviewed?: boolean }) {
  const [items, setItems] = useState<QuizItem[]>(initial);
  const [ai, setAi] = useState(aiGenerated);
  const [topic, setTopic] = useState(""); const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const upd = (i: number, p: Partial<QuizItem>) => setItems(items.map((q, k) => (k === i ? { ...q, ...p } : q)));
  const add = (type: QuizItem["type"]) => setItems([...items, { id: `q${Date.now().toString(36)}${items.length}`, type, prompt: "", options: type === "mc" ? ["", ""] : undefined, answer: type === "mc" ? 0 : type === "tf" ? true : type === "challenge" ? [""] : undefined, explanation: "", points: 1 }]);
  const suggest = () => start(async () => { const r = await suggestQuizAction(topic, 5); if (r.error) setMsg(r.error); else { setItems([...items, ...(r.items ?? [])]); setAi(true); setMsg(`${r.items?.length ?? 0} questões sugeridas por IA. Revise cada uma antes de publicar.`); } });
  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 font-semibold">Questões</legend>
      <input type="hidden" name="items" value={JSON.stringify(items)} /><input type="hidden" name="aiGenerated" value={ai ? "1" : "0"} />
      <div className="rounded-xl border border-dashed border-line p-3">
        <label className="text-sm font-semibold" htmlFor="ai-topic">Sugerir questões por IA (opcional)</label>
        <div className="mt-1 flex flex-wrap gap-2"><input id="ai-topic" className="input flex-1" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Tema, ex.: frações equivalentes" disabled={!aiOn} /><button type="button" className="btn btn-ghost" onClick={suggest} disabled={!aiOn || pending}>{pending ? "Gerando…" : "Sugerir"}</button></div>
        <p className="hint mt-1">{aiOn ? "As sugestões são de prática, ficam identificadas e nunca entram no banco de provas. Você revisa antes de publicar." : "IA não configurada nesta instalação: monte as questões manualmente."}</p>
        {msg && <p className="mt-1 text-sm" role="status">{msg}</p>}
      </div>
      {items.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-line bg-white p-3">
          <div className="flex items-center justify-between gap-2"><p className="text-sm font-bold">{i + 1}. {TYPE[q.type]}{q.id.startsWith("ia") && <span className="badge badge-amber ml-2">sugerida por IA</span>}</p><button type="button" className="link-btn text-danger" onClick={() => setItems(items.filter((_, k) => k !== i))}>Remover</button></div>
          <div className="field mt-2"><label htmlFor={`${q.id}-p`}>Enunciado</label><textarea id={`${q.id}-p`} className="input" value={q.prompt} onChange={(e) => upd(i, { prompt: e.target.value })} /></div>
          {q.type === "mc" && <div className="space-y-2">{(q.options ?? []).map((o, k) => (
            <div key={k} className="flex items-center gap-2"><input type="radio" name={`${q.id}-a`} checked={q.answer === k} onChange={() => upd(i, { answer: k })} aria-label={`Alternativa ${String.fromCharCode(65 + k)} correta`} /><input className="input flex-1" value={o} placeholder={`Alternativa ${String.fromCharCode(65 + k)}`} aria-label={`Texto da alternativa ${String.fromCharCode(65 + k)} da questão ${i + 1}`} onChange={(e) => upd(i, { options: (q.options ?? []).map((x, j) => (j === k ? e.target.value : x)) })} /></div>))}
            {(q.options ?? []).length < 6 && <button type="button" className="link-btn" onClick={() => upd(i, { options: [...(q.options ?? []), ""] })}>+ alternativa</button>}</div>}
          {q.type === "tf" && <div className="flex gap-4"><label className="flex items-center gap-2 font-normal"><input type="radio" name={`${q.id}-tf`} checked={q.answer === true} onChange={() => upd(i, { answer: true })} />A afirmação é verdadeira</label><label className="flex items-center gap-2 font-normal"><input type="radio" name={`${q.id}-tf`} checked={q.answer === false} onChange={() => upd(i, { answer: false })} />É falsa</label></div>}
          {q.type === "challenge" && <div className="field"><label htmlFor={`${q.id}-c`}>Respostas aceitas (uma por linha; ignora acentos e maiúsculas)</label><textarea id={`${q.id}-c`} className="input" value={Array.isArray(q.answer) ? q.answer.join("\n") : ""} onChange={(e) => upd(i, { answer: e.target.value.split("\n") })} /></div>}
          <div className="field mt-2"><label htmlFor={`${q.id}-e`}>Explicação (mostrada conforme a política)</label><input id={`${q.id}-e`} className="input" value={q.explanation ?? ""} onChange={(e) => upd(i, { explanation: e.target.value })} /></div>
          <div className="field max-w-[10rem]"><label htmlFor={`${q.id}-pt`}>Pontos</label><input id={`${q.id}-pt`} className="input" inputMode="decimal" value={String(q.points).replace(".", ",")} onChange={(e) => upd(i, { points: Number(e.target.value.replace(",", ".")) || 0 })} /></div>
        </div>))}
      <div className="flex flex-wrap gap-2">{(["mc", "tf", "challenge", "text"] as const).map((t) => <button key={t} type="button" className="btn btn-ghost btn-sm" onClick={() => add(t)}>+ {TYPE[t].split(" (")[0]}</button>)}</div>
      {ai && <label className="flex items-start gap-2 font-normal"><input type="checkbox" name="reviewed" defaultChecked={reviewed} className="mt-1" />Revisei todas as questões, inclusive as sugeridas por IA, e confirmo que estão corretas.</label>}
    </fieldset>
  );
}
