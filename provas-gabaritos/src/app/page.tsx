import Link from "next/link";
import { instituicoes, resumo } from "@/lib/catalogo";
import { CATEGORIAS, CATEGORIA_ROTULO } from "@/lib/tipos";

export default function Home() {
  return (
    <div className="space-y-10">
      <section className="py-4 text-center md:py-10">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold md:text-6xl">Provas e gabaritos oficiais, <span className="text-brand">uma instituição por vez</span></h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-ink-soft">Escolha o vestibular ou exame, veja todas as edições desde a primeira e baixe a prova e o gabarito direto do site oficial.</p>
        <form action="/buscar" role="search" className="mx-auto mt-6 flex max-w-xl gap-2">
          <label htmlFor="q" className="sr-only">Buscar prova ou gabarito</label>
          <input id="q" name="q" type="search" className="input flex-1" placeholder="Ex.: ENEM 2019, Fuvest 2023" enterKeyHint="search" autoComplete="off" />
          <button className="btn" type="submit">Buscar</button>
        </form>
      </section>
      {CATEGORIAS.map((c) => {
        const lista = instituicoes.filter((i) => i.categoria === c);
        if (!lista.length) return null;
        return (
          <section key={c} aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="mb-3 text-2xl">{CATEGORIA_ROTULO[c]}</h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lista.map((i) => {
                const r = resumo(i.slug);
                return (
                  <li key={i.slug}>
                    <Link href={`/instituicao/${i.slug}`} className="card block h-full no-underline transition hover:-translate-y-0.5 hover:border-brand">
                      <div className="flex items-start justify-between gap-2"><span className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{i.sigla}</span>
                        {r.edicoes > 0 ? <span className="badge badge-ok">{r.edicoes} edições</span> : <span className="badge badge-warn">Em breve</span>}</div>
                      <p className="mt-1 text-sm font-semibold text-ink">{i.nome}</p>
                      <p className="hint mt-1">{i.descricao}</p>
                      <p className="mt-3 text-sm font-semibold text-brand">{r.edicoes > 0 ? `${r.de}–${r.ate} · ver provas →` : "Ver página →"}</p>
                    </Link>
                  </li>);
              })}
            </ul>
          </section>);
      })}
    </div>
  );
}
