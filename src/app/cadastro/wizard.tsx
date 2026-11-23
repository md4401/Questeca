"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { saveDraftAction, finishOnboardingAction } from "./actions";
import { createDemoClassAction } from "@/app/app/turmas/actions";
import { SUBJECTS, subjectLabel, normalize } from "@/lib/taxonomy";
import { GRADE_GROUPS, LETTERS, UFS, className, flatten, reconcile, stepProblem, summarize, type Draft, type SchoolChoice } from "@/lib/core/onboarding";

type Hit = { id: string; name: string; city: string; uf: string; neighborhood: string | null; dependency: string | null };
type Props = { initial: Draft; linkedName: string | null; knownClasses: Record<string, string[]>; editing: boolean };

export function Wizard({ initial, linkedName, knownClasses, editing }: Props) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const topRef = useRef<HTMLHeadingElement>(null);
  const step = d.step;

  const go = useCallback((to: 1 | 2 | 3 | 4, next?: Draft) => {
    const nd = { ...(next ?? d), step: to } as Draft;
    setD(nd); setError(null);
    start(async () => { await saveDraftAction(nd); });
    requestAnimationFrame(() => { topRef.current?.focus(); window.scrollTo({ top: 0 }); });
  }, [d]);

  const cont = () => {
    if (step === 4) return;
    const p = stepProblem(d, step as 1 | 2 | 3);
    if (p) { setError(p); return; }
    go((step + 1) as 2 | 3 | 4);
  };
  const finish = () => {
    setError(null);
    start(async () => { const r = await finishOnboardingAction(d); if (r?.error) setError(r.error); });
  };
  const titles = ["Escolha seu colégio", "O que você ensina?", "Séries e turmas", "Confira e conclua"];

  return (
    <div className="wiz-shell">
      <header className="wiz-top">
        <div className="mx-auto flex max-w-[34rem] items-center justify-between">
          {step > 1 ? <button type="button" className="link-btn w-24 text-left" onClick={() => go((step - 1) as 1 | 2 | 3)}>← Voltar</button>
            : editing ? <Link href="/app/conta" className="link-btn w-24 no-underline">← Voltar</Link> : <span className="w-24" />}
          <Logo href="/app" />
          <span className="w-24 whitespace-nowrap text-right text-sm font-semibold text-ink-soft">{step <= 3 ? `Etapa ${step} de 3` : "Revisão"}</span>
        </div>
        <div className="wiz-progress mx-auto max-w-[34rem]" aria-hidden>{[1, 2, 3].map((n) => <i key={n} data-on={step >= n} />)}</div>
      </header>

      <main className="wiz-body">
        <h1 ref={topRef} tabIndex={-1} className="outline-none">{titles[step - 1]}</h1>
        {step === 1 && <StepSchool d={d} setD={setD} linkedName={linkedName} />}
        {step === 2 && <StepSubjects d={d} setD={(n) => setD(reconcile(n))} />}
        {step === 3 && <StepClasses d={d} setD={setD} knownClasses={knownClasses} />}
        {step === 4 && <Review d={d} go={go} />}
        {error && <p className="err mt-4" role="alert">{error}</p>}
      </main>

      <div className="wiz-bar">
        <div>
          {step < 4
            ? <button type="button" className="btn" onClick={cont} disabled={pending}>Continuar</button>
            : <button type="button" className="btn" onClick={finish} disabled={pending} aria-busy={pending}>{pending ? "Salvando…" : "Concluir cadastro"}</button>}
          {step === 1 && !editing && <p className="sticky-note text-center">Seus dados ficam salvos: você pode fechar e voltar de onde parou.</p>}
          {step === 1 && !editing && <form action={createDemoClassAction} className="text-center"><button type="submit" className="link-btn">Só quer conhecer? Usar uma turma de exemplo</button></form>}
        </div>
      </div>
    </div>
  );
}

/* ---------- Etapa 1: escola ---------- */
function StepSchool({ d, setD, linkedName }: { d: Draft; setD: (d: Draft) => void; linkedName: string | null }) {
  const sel = d.school;
  const [q, setQ] = useState(sel && (sel.kind === "catalog" || sel.kind === "manual") ? sel.name : "");
  const [uf, setUf] = useState(""); const [cidade, setCidade] = useState("");
  const [filters, setFilters] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "empty" | "error">("idle");
  const [hits, setHits] = useState<Hit[]>([]);
  const [coverage, setCoverage] = useState<"full" | "partial" | "empty">("full");
  const [manual, setManual] = useState(sel?.kind === "manual");
  const seq = useRef(0); const ctl = useRef<AbortController | null>(null);

  const run = useCallback(async (term: string, u: string, c: string) => {
    ctl.current?.abort();
    if (normalize(term).replace(/[^a-z0-9]/g, "").length < 2) { setStatus("idle"); setHits([]); return; }
    const my = ++seq.current; const ac = new AbortController(); ctl.current = ac;
    setStatus("loading");
    try {
      const qs = new URLSearchParams({ q: term }); if (u) qs.set("uf", u); if (c) qs.set("cidade", c);
      const r = await fetch(`/api/escolas?${qs}`, { signal: ac.signal, cache: "no-store" });
      if (my !== seq.current) return; // resposta atrasada de consulta anterior
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json() as { results: Hit[]; coverage: "full" | "partial" | "empty" };
      setHits(j.results); setCoverage(j.coverage); setStatus(j.results.length ? "ok" : "empty");
    } catch (e) { if ((e as Error).name !== "AbortError" && my === seq.current) setStatus("error"); }
  }, []);

  useEffect(() => { const t = setTimeout(() => run(q, uf, cidade), 300); return () => clearTimeout(t); }, [q, uf, cidade, run]);

  const pick = (h: Hit) => setD({ ...d, school: { kind: "catalog", id: h.id, name: h.name, city: h.city, uf: h.uf, neighborhood: h.neighborhood } });
  const picked = sel?.kind === "catalog" ? sel.id : null;

  if (linkedName) {
    return (
      <div className="mt-4 space-y-3">
        <p className="text-ink-soft">Você foi convidado(a) por uma escola. Confirme se é aqui que você dá aula.</p>
        <button type="button" className="opt" aria-pressed={sel?.kind === "linked"} onClick={() => setD({ ...d, school: { kind: "linked", orgId: "", name: linkedName } as SchoolChoice })}>
          <span><b>{linkedName}</b><small>Escola vinculada pelo convite</small></span><span className="tick" aria-hidden>✓</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-ink-soft">Digite parte do nome e toque no resultado correto.</p>
      <div className="field !mb-0">
        <label htmlFor="school-q">Nome do colégio</label>
        <input id="school-q" className="input" value={q} onChange={(e) => { setQ(e.target.value); if (picked) setD({ ...d, school: undefined }); }} placeholder="Ex.: Colégio Horizonte" autoComplete="off" autoCapitalize="words" enterKeyHint="search" inputMode="search" role="combobox" aria-expanded={status === "ok"} aria-controls="school-list" />
      </div>
      <button type="button" className="link-btn" onClick={() => setFilters((v) => !v)} aria-expanded={filters}>{filters ? "Ocultar filtro de cidade" : "Filtrar por cidade e UF"}</button>
      {filters && (
        <div className="grid grid-cols-[1fr_5.5rem] gap-2">
          <div className="field !mb-0"><label htmlFor="school-city">Cidade</label><input id="school-city" className="input" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Osasco" autoComplete="off" /></div>
          <div className="field !mb-0"><label htmlFor="school-uf">UF</label>
            <select id="school-uf" className="input" value={uf} onChange={(e) => setUf(e.target.value)}><option value="">Todas</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></div>
        </div>)}

      <div id="school-list" aria-live="polite" className="space-y-2">
        {status === "loading" && <>{[0, 1].map((i) => <div key={i} className="skeleton wiz-skel" aria-hidden />)}<span className="sr-only">Buscando escolas…</span></>}
        {status === "ok" && hits.map((h) => (
          <button key={h.id} type="button" className="opt" aria-pressed={picked === h.id} onClick={() => pick(h)}>
            <span><b>{h.name}</b><small>{[h.neighborhood, `${h.city} · ${h.uf}`].filter(Boolean).join(" · ")}{h.dependency ? ` · ${h.dependency}` : ""}</small></span>
            <span className="tick" aria-hidden>✓</span>
          </button>))}
        {status === "empty" && (
          <div className="card-tint text-sm"><p><b>Nenhuma escola encontrada</b> para “{q}”{cidade ? ` em ${cidade}` : ""}.</p>
            <p className="mt-1 text-ink-soft">Confira a grafia, tente menos palavras ou <button type="button" className="link-btn" onClick={() => setFilters(true)}>altere a cidade</button>.</p></div>)}
        {status === "error" && (
          <div className="card-amber text-sm" role="alert"><p><b>Não foi possível buscar agora.</b> Verifique sua conexão.</p>
            <div className="mt-2 flex gap-3"><button type="button" className="link-btn" onClick={() => run(q, uf, cidade)}>Tentar novamente</button><button type="button" className="link-btn" onClick={() => setFilters(true)}>Alterar cidade</button></div></div>)}
        {(status === "ok" || status === "empty") && coverage !== "full" && (
          <p className="sticky-note">{coverage === "empty" ? "O catálogo de escolas ainda não foi carregado nesta instalação." : "Cobertura parcial: o catálogo ainda não inclui todas as escolas."} Se não encontrar, use a opção abaixo.</p>)}
      </div>

      <div className="space-y-2 border-t border-line pt-4">
        <button type="button" className="opt" aria-pressed={sel?.kind === "manual" || manual} onClick={() => { setManual(true); setD({ ...d, school: { kind: "manual", name: q.trim(), city: cidade, uf } }); }}>
          <span><b>Não encontrei meu colégio</b><small>Cadastrar manualmente (fica como informação do perfil)</small></span><span className="tick" aria-hidden>✓</span>
        </button>
        {manual && sel?.kind === "manual" && (
          <div className="card space-y-2">
            <div className="field !mb-0"><label htmlFor="m-name">Nome do colégio</label><input id="m-name" className="input" value={sel.name} onChange={(e) => setD({ ...d, school: { ...sel, name: e.target.value } })} /></div>
            <div className="grid grid-cols-[1fr_5.5rem] gap-2">
              <div className="field !mb-0"><label htmlFor="m-city">Cidade</label><input id="m-city" className="input" value={sel.city} onChange={(e) => setD({ ...d, school: { ...sel, city: e.target.value } })} /></div>
              <div className="field !mb-0"><label htmlFor="m-uf">UF</label><select id="m-uf" className="input" value={sel.uf} onChange={(e) => setD({ ...d, school: { ...sel, uf: e.target.value } })}><option value="">—</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></div>
            </div>
          </div>)}
        <button type="button" className="opt" aria-pressed={sel?.kind === "none"} onClick={() => { setManual(false); setD({ ...d, school: { kind: "none" } }); }}>
          <span><b>Não dou aula em uma escola fixa</b><small>Uso pessoal, aulas particulares ou várias escolas</small></span><span className="tick" aria-hidden>✓</span>
        </button>
      </div>
    </div>
  );
}

/* ---------- Etapa 2: disciplinas ---------- */
function StepSubjects({ d, setD }: { d: Draft; setD: (d: Draft) => void }) {
  const [more, setMore] = useState(() => d.subjects.some((s) => !SUBJECTS.find((x) => x.value === s)?.main));
  const [find, setFind] = useState(""); const [other, setOther] = useState("");
  const toggle = (v: string) => setD({ ...d, subjects: d.subjects.includes(v) ? d.subjects.filter((x) => x !== v) : [...d.subjects, v] });
  const main = SUBJECTS.filter((s) => s.main);
  const rest = SUBJECTS.filter((s) => !s.main && (!find || normalize(s.label).includes(normalize(find))));
  const customs = d.subjects.filter((s) => s.startsWith("custom:"));
  const addOther = () => { const t = other.trim().slice(0, 50); if (t.length < 2) return; const v = `custom:${t}`; if (!d.subjects.includes(v)) setD({ ...d, subjects: [...d.subjects, v] }); setOther(""); };
  const Opt = ({ v, label }: { v: string; label: string }) => (
    <button type="button" className="opt" aria-pressed={d.subjects.includes(v)} onClick={() => toggle(v)}><b>{label}</b><span className="tick" aria-hidden>✓</span></button>);
  return (
    <div className="mt-4 space-y-4">
      <p className="text-ink-soft">Marque todas as que você leciona.</p>
      <p className="text-sm font-semibold text-brand-dark" aria-live="polite">{d.subjects.length === 0 ? "Nenhuma selecionada" : d.subjects.length === 1 ? "1 selecionada" : `${d.subjects.length} selecionadas`}</p>
      <div className="grid gap-2 min-[420px]:grid-cols-2">{main.map((s) => <Opt key={s.value} v={s.value} label={s.label} />)}</div>
      <button type="button" className="link-btn" onClick={() => setMore((v) => !v)} aria-expanded={more}>{more ? "Mostrar menos" : "Ver mais disciplinas"}</button>
      {more && (
        <div className="space-y-2">
          <div className="field !mb-0"><label htmlFor="sub-find">Buscar disciplina</label><input id="sub-find" className="input" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Ex.: Filosofia" /></div>
          <div className="grid gap-2 min-[420px]:grid-cols-2">{rest.map((s) => <Opt key={s.value} v={s.value} label={s.label} />)}</div>
          {rest.length === 0 && <p className="hint">Nada com esse nome. Use “Outra disciplina”.</p>}
        </div>)}
      <div className="border-t border-line pt-4">
        <label htmlFor="sub-other" className="text-sm font-semibold">Outra disciplina</label>
        <div className="mt-1 flex gap-2"><input id="sub-other" className="input flex-1" value={other} onChange={(e) => setOther(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOther(); } }} placeholder="Ex.: Robótica" enterKeyHint="done" />
          <button type="button" className="btn btn-ghost" onClick={addOther}>Adicionar</button></div>
        {customs.length > 0 && <div className="mt-3 grid gap-2">{customs.map((c) => <Opt key={c} v={c} label={subjectLabel(c)} />)}</div>}
      </div>
    </div>
  );
}

/* ---------- Etapa 3: séries e turmas ---------- */
function StepClasses({ d, setD, knownClasses }: { d: Draft; setD: (d: Draft) => void; knownClasses: Record<string, string[]> }) {
  const [custom, setCustom] = useState<Record<string, string>>({});
  const setLabels = (sub: string, grade: string, labels: string[] | null) => {
    const by = { ...(d.assignments[sub] ?? {}) };
    if (labels === null) delete by[grade]; else by[grade] = labels;
    setD({ ...d, assignments: { ...d.assignments, [sub]: by } });
  };
  return (
    <div className="mt-4 space-y-5">
      <p className="text-ink-soft">Para cada disciplina, escolha as séries e depois as turmas.</p>
      {d.subjects.map((sub) => {
        const by = d.assignments[sub] ?? {};
        const names = flatten({ ...d, subjects: [sub] }).map((a) => a.name);
        return (
          <section key={sub} className="card space-y-4" aria-labelledby={`h-${sub}`}>
            <h2 id={`h-${sub}`} className="text-lg">{subjectLabel(sub)}</h2>
            {GRADE_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mb-2 text-sm font-semibold text-ink-soft">{g.label}</p>
                <div className="flex flex-wrap gap-2">
                  {g.grades.map((gr) => <button key={gr.value} type="button" className="chip" aria-pressed={gr.value in by} onClick={() => setLabels(sub, gr.value, gr.value in by ? null : [])}>{gr.short}</button>)}
                </div>
              </div>))}
            {Object.keys(by).map((grade) => {
              const suggested = [...LETTERS, ...((knownClasses[grade] ?? []).filter((n) => !LETTERS.some((l) => className(grade, l) === n)))];
              const key = `${sub}|${grade}`;
              const gname = GRADE_GROUPS.flatMap((x) => x.grades).find((x) => x.value === grade)?.short;
              const chosen = by[grade];
              const extras = chosen.filter((c) => !LETTERS.includes(c) && !(knownClasses[grade] ?? []).includes(c));
              const toggle = (l: string) => setLabels(sub, grade, chosen.includes(l) ? chosen.filter((x) => x !== l) : [...chosen, l]);
              const add = () => { const t = (custom[key] ?? "").trim().slice(0, 40); if (t && !chosen.includes(t)) setLabels(sub, grade, [...chosen, t]); setCustom({ ...custom, [key]: "" }); };
              return (
                <div key={grade} className="rounded-xl bg-brand-tint/60 p-3">
                  <p className="mb-2 text-sm font-semibold">Turmas do {gname}</p>
                  <div className="flex flex-wrap gap-2">
                    {suggested.map((l) => <button key={l} type="button" className="chip" aria-pressed={chosen.includes(l)} aria-label={`Turma ${l}, ${gname}`} onClick={() => toggle(l)}>{l.length > 2 ? l : l}</button>)}
                    {extras.map((l) => <button key={l} type="button" className="chip" aria-pressed onClick={() => toggle(l)}>{l} ×</button>)}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className="input flex-1" aria-label={`Outra identificação, ${gname}`} placeholder="Outra identificação" value={custom[key] ?? ""} onChange={(e) => setCustom({ ...custom, [key]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} enterKeyHint="done" />
                    <button type="button" className="btn btn-ghost" onClick={add}>Adicionar</button>
                  </div>
                </div>);
            })}
            {names.length > 0 && <p className="rounded-lg bg-white/70 px-3 py-2 text-sm font-semibold text-brand-dark">{summarize(subjectLabel(sub), names)}</p>}
          </section>);
      })}
    </div>
  );
}

/* ---------- Revisão ---------- */
function Review({ d, go }: { d: Draft; go: (s: 1 | 2 | 3 | 4) => void }) {
  const s = d.school;
  const school = !s ? "—" : s.kind === "none" ? "Sem escola fixa" : s.kind === "linked" ? s.name : `${s.name}${s.kind === "catalog" || s.kind === "manual" ? ` · ${s.city}/${s.uf}` : ""}${s.kind === "manual" ? " (informado por você)" : ""}`;
  return (
    <div className="mt-4 space-y-3">
      <p className="text-ink-soft">Tudo certo? Você pode editar qualquer parte.</p>
      <div className="card"><div className="flex items-start justify-between gap-3"><div><p className="hint">Colégio</p><p className="font-semibold">{school}</p></div><button className="link-btn" type="button" onClick={() => go(1)}>Editar</button></div></div>
      <div className="card"><div className="flex items-start justify-between gap-3"><div><p className="hint">Disciplinas</p><p className="font-semibold">{d.subjects.map(subjectLabel).join(", ")}</p></div><button className="link-btn" type="button" onClick={() => go(2)}>Editar</button></div></div>
      <div className="card"><div className="flex items-start justify-between gap-3"><div><p className="hint">Séries e turmas</p>
        <ul className="font-semibold">{d.subjects.map((sub) => <li key={sub}>{summarize(subjectLabel(sub), flatten({ ...d, subjects: [sub] }).map((a) => a.name))}</li>)}</ul></div>
        <button className="link-btn" type="button" onClick={() => go(3)}>Editar</button></div></div>
    </div>
  );
}
