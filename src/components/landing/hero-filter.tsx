"use client";
import { useId, useMemo, useState } from "react";

type T = "pct" | "desc" | "juros" | "estat";
const TOPICS: { id: T; label: string }[] = [
  { id: "pct", label: "Porcentagem" },
  { id: "desc", label: "Descontos sucessivos" },
  { id: "juros", label: "Juros compostos" },
  { id: "estat", label: "Média e mediana" },
];
// Questões autorais de exemplo, usadas só nesta demonstração.
const QUESTIONS: { n: string; text: string; needs: T[] }[] = [
  { n: "01", text: "Uma camisa de R$ 80,00 tem 25% de desconto. Quanto passa a custar?", needs: ["pct"] },
  { n: "02", text: "Um produto de R$ 200,00 recebe 10% de desconto e, depois, mais 10% sobre o novo preço.", needs: ["pct", "desc"] },
  { n: "03", text: "Uma dívida de R$ 1.000,00 cresce 5% ao mês sobre o saldo anterior. Quanto deve após 2 meses?", needs: ["pct", "juros"] },
  { n: "04", text: "As notas foram 6, 7, 8, 9 e 10. Qual é a média aritmética?", needs: ["estat"] },
];

/** Folha de exemplo: uma escolha ("Já ensinei juros compostos") muda a questão 03 e o total. O exemplo completo usa as mesmas escolhas. */
export function HeroFilter() {
  const [taught, setTaught] = useState<Record<T, boolean>>({ pct: true, desc: true, juros: false, estat: false });
  const [full, setFull] = useState(false);
  const fullId = useId();
  const toggle = (t: T) => setTaught((s) => ({ ...s, [t]: !s[t] }));
  const rows = useMemo(() => QUESTIONS.map((q) => {
    const missing = q.needs.filter((t) => !taught[t]);
    return { ...q, ok: missing.length === 0, missing };
  }), [taught]);
  const okCount = rows.filter((r) => r.ok).length;
  const shown = full ? rows : rows.filter((r) => r.n === "03");
  return (
    <section className="min-w-0 rounded-xl border border-line bg-white p-4 md:p-6" aria-label="Exemplo da folha da prova">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">9º B · Matemática</p>
          <p className="text-lg font-bold">O que a turma já estudou?</p>
        </div>
        <span className="badge badge-gray">Exemplo</span>
      </div>

      {full ? (
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Conteúdos ensinados">
          {TOPICS.map((t) => (
            <button key={t.id} type="button" aria-pressed={taught[t.id]} onClick={() => toggle(t.id)} className="chip text-base">{t.label}</button>))}
        </div>
      ) : (
        <button type="button" aria-pressed={taught.juros} onClick={() => toggle("juros")} className="opt mb-4">
          <span><b>Já ensinei juros compostos</b><small>Toque para ver a questão 03 entrar na prova</small></span><span className="tick" aria-hidden>✓</span>
        </button>
      )}

      <ol className="space-y-2.5" id={fullId}>
        {shown.map((q) => (
          <li key={q.n} className={`rounded-lg border p-3.5 transition-all duration-300 ${q.ok ? "border-line bg-white" : "border-dashed border-[#E9B8B2] bg-[#FFFBFA]"}`}>
            <div className="flex items-start gap-3">
              <span className="mono mt-0.5 text-xs text-ink-soft">{q.n}</span>
              <p className={`statement flex-1 text-base leading-snug ${q.ok ? "" : "text-ink-soft"}`}>{q.text}</p>
            </div>
            <p className={`mt-1.5 pl-7 text-base font-semibold ${q.ok ? "text-brand-dark" : "text-danger"}`}>
              {q.ok ? "Entra na prova" : `Fica de fora${q.missing.length ? `: exige ${q.missing.map((m) => TOPICS.find((t) => t.id === m)!.label.toLowerCase()).join(" e ")}` : ""}`}
            </p>
          </li>))}
      </ol>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <p className="text-base font-semibold" role="status" aria-live="polite">{okCount} de {rows.length} entram na prova</p>
        <button type="button" className="link-btn !min-h-[44px] !text-base" aria-expanded={full} aria-controls={fullId} onClick={() => setFull((v) => !v)}>{full ? "Ver só uma questão" : "Ver exemplo completo"}</button>
      </div>
    </section>
  );
}
