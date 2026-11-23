/** Esqueleto de carregamento: mantém o layout enquanto os dados chegam. */
export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Carregando" className="space-y-6">
      <div className="space-y-2"><div className="skeleton h-8 w-64" /><div className="skeleton h-4 w-40" /></div>
      <div className="grid gap-4 md:grid-cols-3">{[0, 1, 2].map((k) => <div key={k} className="card space-y-3"><div className="skeleton h-5 w-2/3" /><div className="skeleton h-4 w-1/2" /><div className="skeleton h-16 w-full" /></div>)}</div>
      <div className="card space-y-3">{Array.from({ length: rows }, (_, k) => <div key={k} className="skeleton h-10 w-full" />)}</div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
