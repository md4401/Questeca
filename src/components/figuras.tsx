/** Figuras recortadas do PDF oficial da questão (gráficos, tabelas, mapas). */
export function Figuras({ ids, className = "" }: { ids?: string[]; className?: string }) {
  if (!ids?.length) return null;
  return (
    <div className={`questao-figs ${className}`}>
      {ids.map((id) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={id} src={`/api/questao-imagem/${id}`} alt="Figura da questão, recortada da prova oficial" loading="lazy" />
      ))}
    </div>
  );
}
