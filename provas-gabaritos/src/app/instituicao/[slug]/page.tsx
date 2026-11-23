import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { instituicoes, instituicao, edicoesDe, resumo, comStatus } from "@/lib/catalogo";
import { CATEGORIA_ROTULO } from "@/lib/tipos";
import { EdicoesFiltradas } from "@/components/edicoes-filtradas";

export const dynamicParams = false;
export const generateStaticParams = () => instituicoes.map((i) => ({ slug: i.slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const i = instituicao((await params).slug);
  return i ? { title: `Provas e gabaritos ${i.sigla}`, description: `Baixe provas e gabaritos oficiais ${i.nome} (${i.sigla}), edição por edição.` } : {};
}

export default async function Pagina({ params }: { params: Promise<{ slug: string }> }) {
  const i = instituicao((await params).slug);
  if (!i) notFound();
  const lista = edicoesDe(i.slug).map(comStatus);
  const r = resumo(i.slug);
  const fonte = i.paginaProvas ?? i.site;
  return (
    <div className="space-y-6">
      <p className="hint"><Link href="/">Instituições</Link> › {i.sigla}</p>
      <header>
        <p className="badge">{CATEGORIA_ROTULO[i.categoria]}</p>
        <h1 className="mt-2 text-4xl font-extrabold md:text-5xl">{i.sigla} <span className="block text-xl font-semibold text-ink-soft md:text-2xl">{i.nome}</span></h1>
        <p className="mt-3 max-w-2xl text-ink-soft">{i.descricao}</p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm"><span><strong>{r.edicoes}</strong> edições · <strong>{r.arquivos}</strong> arquivos{r.de ? ` · de ${r.de} a ${r.ate}` : ""}</span>{i.primeiraEdicao && <span>Primeira edição: <strong>{i.primeiraEdicao}</strong></span>}{fonte && <a href={fonte} target="_blank" rel="noopener nofollow">Site oficial</a>}</p>
        {i.observacao && <p className="hint mt-2">{i.observacao}</p>}
      </header>
      {lista.length === 0 ? (
        <section className="card" aria-live="polite"><h2 className="text-xl">Ainda não há edições cadastradas</h2>
          <p className="mt-1 text-ink-soft">Estamos reunindo os links oficiais de {i.sigla}. Enquanto isso, as provas costumam estar na página da própria instituição.</p>
          {fonte && <p className="mt-3"><a className="btn" href={fonte} target="_blank" rel="noopener nofollow">Abrir o site oficial</a></p>}</section>
      ) : <EdicoesFiltradas edicoes={lista} />}
    </div>
  );
}
