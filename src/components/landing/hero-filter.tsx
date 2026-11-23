"use client";
import { useMemo, useState } from "react";

type T = "pct" | "desc" | "juros" | "estat";
const TOPICS: { id: T; label: string }[] = [
  { id: "pct", label: "Porcentagem" },
  { id: "desc", label: "Descontos sucessivos" },
  { id: "juros", label: "Juros compostos" },
  { id: "estat", label: "Média e mediana" },
];
// Questões autorais de exemplo da Questeca (mesmas do acervo de demonstração).
const QUESTIONS: { n: string; text: string; needs: T[] }[] = [
  { n: "01", text: "Uma camisa de R$ 80,00 tem 25% de desconto. Quanto passa a custar?", needs: ["pct"] },
  { n: "02", text: "Um produto de R$ 200,00 recebe 10% de desconto e, depois, mais 10% sobre o novo preço.", needs: ["pct", "desc"] },
  { n: "03", text: "Uma dívida de R$ 1.000,00 cresce 5% ao mês sobre o saldo anterior. Quanto deve após 2 meses?", needs: ["pct", "juros"] },
  { n: "04", text: "As notas foram 6, 7, 8, 9 e 10. Qual é a média aritmética?", needs: ["estat"] },
];

/** Demonstração do filtro: só entra o que exige conteúdo marcado como ensinado. */
export function HeroFilter() {
  const [taught, setTaught] = useState<Record<T, boolean>>({ pct: true, desc: true, juros: false, estat: false });
  const rows = useMemo(() => QUESTIONS.map((q) => {
    const missing = q.needs.filter((t) => !taught[t]);
    return { ...q, ok: missing.length === 0, missing };
  }), [taught]);
  const okCount = rows.filter((r) => r.ok).length;
  return (
    <div className="glass glass-strong relative p-5 md:p-6" aria-label="Demonstração do filtro de conteúdo (exemplo)">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="mono text-[11px] uppercase tracking-[.14em] text-ink-soft">9º B · Matemática · exemplo</p>
          <p className="display text-lg">O que a turma já estudou?</p>
        </div>
        <span className="badge" aria-live="polite">{okCount} de {rows.length} entram</span>
      </div>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Conteúdos ensinados">
        {TOPICS.map((t) => (
          <button key={t.id} type="button" aria-pressed={taught[t.id]} onClick={() => setTaught((s) => ({ ...s, [t.id]: !s[t.id] }))}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-all duration-300 ${taught[t.id] ? "border-brand bg-brand text-white shadow-[0_8px_18px_-10px_rgba(31,79,224,.9)]" : "border-line bg-white/70 text-ink-soft hover:border-[#9FB3DC] hover:text-ink"}`}>
            <span aria-hidden className={`grid h-4 w-4 place-items-center rounded-full border text-[10px] ${taught[t.id] ? "border-white bg-white text-brand" : "border-[#9FB3DC]"}`}>{taught[t.id] ? "✓" : ""}</span>
            {t.label}
          </button>))}
      </div>
      <ol className="space-y-2.5">
        {rows.map((q) => (
          <li key={q.n} className={`relative overflow-hidden rounded-xl border bg-white p-3.5 transition-all duration-500 ${q.ok ? "border-line opacity-100" : "border-dashed border-[#E9B8B2] bg-[#FFFBFA] opacity-80"}`}>
            <div className="flex items-start gap-3">
              <span className="mono mt-0.5 text-xs text-ink-soft">{q.n}</span>
              <p className={`statement flex-1 text-[15px] leading-snug transition-colors ${q.ok ? "" : "text-ink-soft line-through decoration-[#E9B8B2]"}`}>{q.text}</p>
            </div>
            <p className={`mt-1.5 pl-7 text-xs font-semibold ${q.ok ? "text-brand-dark" : "text-danger"}`}>
              {q.ok ? "Entra: só exige o que foi ensinado" : `Fica de fora: exige ${q.missing.map((m) => TOPICS.find((t) => t.id === m)!.label.toLowerCase()).join(" e ")}`}
            </p>
          </li>))}
      </ol>
      <p className="mt-4 text-xs text-ink-soft">Toque nos conteúdos para ver o filtro agir. Questões autorais de exemplo.</p>
    </div>
  );
}
