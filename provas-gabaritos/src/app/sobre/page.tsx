import type { Metadata } from "next";
import { instituicoes } from "@/lib/catalogo";

export const metadata: Metadata = { title: "Sobre e direitos autorais" };
const CONTATO = process.env.NEXT_PUBLIC_CONTATO ?? "";

export default function Sobre() {
  return (
    <article className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-4xl font-extrabold">Como funciona</h1>
      <p>O site reúne, em um só lugar, os links <strong>oficiais</strong> das provas e dos gabaritos de {instituicoes.length} instituições. Você escolhe a instituição, encontra a edição e baixa o arquivo. O botão leva direto ao arquivo no site da própria banca.</p>
      <h2 className="text-2xl">De onde vêm os arquivos</h2>
      <p>Cada edição indica a <em>página oficial</em> de onde o link foi tirado. Conferimos periodicamente se os links ainda respondem; quando um deixa de funcionar, o botão passa a levar à página oficial e o aviso “link fora do ar” aparece.</p>
      <h2 className="text-2xl">Direitos autorais</h2>
      <p>As provas, os gabaritos e as marcas pertencem às respectivas instituições e bancas. Este site <strong>não hospeda, não copia e não altera</strong> esses arquivos: ele apenas organiza e aponta para onde a própria instituição os publica. Se você é titular de algum conteúdo e quer um link removido ou ajustado, escreva{CONTATO ? <> para <a href={`mailto:${CONTATO}`}>{CONTATO}</a></> : " pelo canal de contato do site"}.</p>
      <h2 className="text-2xl">Encontrou um link quebrado ou uma edição que falta?</h2>
      <p>{CONTATO ? <>Avise em <a href={`mailto:${CONTATO}`}>{CONTATO}</a> com o nome da instituição, o ano e, se tiver, o endereço da página oficial.</> : "Avise pelo canal de contato do site com o nome da instituição, o ano e, se tiver, o endereço da página oficial."}</p>
      <h2 className="text-2xl">Instituições</h2>
      <ul className="grid gap-1 text-sm sm:grid-cols-2">{instituicoes.map((i) => <li key={i.slug}><strong>{i.sigla}</strong> — {i.nome}</li>)}</ul>
    </article>
  );
}
