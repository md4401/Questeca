import Link from "next/link";

export default function NotFound() {
  return (
    <main id="conteudo" className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="badge">404</p>
      <h1 className="mt-3">Página não encontrada</h1>
      <p className="mt-2 text-ink-soft">O endereço não existe ou você não tem acesso a este conteúdo. Confira o link ou o contexto de escola ativo.</p>
      <p className="mt-6"><Link className="btn" href="/app">Ir para o início</Link></p>
    </main>
  );
}
