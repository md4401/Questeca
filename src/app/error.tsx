"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="conteudo" className="mx-auto max-w-md px-4 py-20 text-center">
      <h1>Algo deu errado</h1>
      <p className="mt-2 text-ink-soft">Seu trabalho já salvo foi preservado. Tente novamente; se persistir, fale com o suporte.</p>
      <p className="mt-6 flex justify-center gap-3"><button className="btn" onClick={() => reset()}>Tentar novamente</button><a className="btn btn-ghost" href="/ajuda#contato">Falar com o suporte</a></p>
    </main>
  );
}
