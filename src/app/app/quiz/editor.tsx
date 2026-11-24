"use client";
import { useState } from "react";
import { Form, SubmitButton } from "@/components/form";
import { salvarQuizAction, gerarQuizIAAction, excluirQuizAction } from "./actions";
import { ConfirmButton } from "@/components/form";

const EXEMPLO = "Quanto é 7 × 8? [20s]\n- 54\n* 56\n- 58\n- 64\n\nQual é o maior planeta do Sistema Solar?\n* Júpiter\n- Saturno\n- Terra";

/** Editor de quiz: texto simples (* certa, - errada) e geração opcional pela GizIA. */
export function QuizEditor({ id, title = "", texto = "" }: { id: string | null; title?: string; texto?: string }) {
  const [t, setT] = useState(texto);
  const [ia, setIa] = useState<{ erro?: string; ok?: string } | null>(null); const [gerando, setGerando] = useState(false);
  async function gerar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setGerando(true); setIa(null);
    const r = await gerarQuizIAAction(null, new FormData(e.currentTarget));
    if (r?.texto) setT((old) => (old.trim() ? `${old.trim()}\n\n${r.texto}` : r.texto!));
    setIa({ erro: r?.error, ok: r?.ok }); setGerando(false);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <section className="card"><h2 className="mb-2 text-lg">{id ? "Perguntas" : "Novo quiz"}</h2>
        <Form action={salvarQuizAction.bind(null, id)} toast>
          <div className="field"><label htmlFor="title">Nome do quiz</label><input id="title" name="title" className="input" defaultValue={title} required /></div>
          <div className="field"><label htmlFor="texto">Perguntas</label>
            <textarea id="texto" name="texto" className="input min-h-[22rem] font-mono text-sm" value={t} onChange={(e) => setT(e.target.value)} placeholder={EXEMPLO} />
            <span className="hint">Uma pergunta por bloco (separe com linha em branco). Opções: <b>*</b> na certa e <b>-</b> nas erradas (2 a 4). Opcional: <b>[30s]</b> no fim do enunciado muda o tempo (padrão 20 s).</span></div>
          <div className="flex flex-wrap items-center gap-3"><SubmitButton>Salvar quiz</SubmitButton></div>
        </Form>
        {id && <form action={excluirQuizAction.bind(null, id)} className="mt-3"><ConfirmButton message="Excluir este quiz?" className="link-btn text-danger">Excluir quiz</ConfirmButton></form>}
      </section>
      <section className="card h-fit"><h2 className="mb-2 text-lg">Gerar com a GizIA</h2>
        <form onSubmit={gerar}>
          <div className="field"><label htmlFor="tema">Tema</label><input id="tema" name="tema" className="input" placeholder="Ex.: Revolução Francesa" /></div>
          <div className="field"><label htmlFor="serie">Série (opcional)</label><input id="serie" name="serie" className="input" placeholder="Ex.: 9º ano" /></div>
          <div className="field"><label htmlFor="n">Quantas perguntas</label><input id="n" name="n" type="number" min={3} max={15} defaultValue={8} className="input" /></div>
          <button className="btn" type="submit" disabled={gerando} aria-busy={gerando}>{gerando ? "Gerando…" : "Gerar perguntas"}</button>
          {ia?.erro && <p className="err mt-2 text-sm" role="alert">{ia.erro}</p>}{ia?.ok && <p className="mt-2 text-sm text-ok" role="status">{ia.ok}</p>}
        </form>
        <p className="hint mt-3">As perguntas entram no editor ao lado para você revisar e ajustar antes de salvar.</p>
      </section>
    </div>
  );
}
