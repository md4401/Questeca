import type { Edicao } from "@/lib/tipos";
import { TIPO_ROTULO } from "@/lib/tipos";
import { linkDownload } from "@/lib/download";

/** Versão do cartão usada em componentes de cliente: recebe o status dos links já resolvido no servidor. */
export function EdicaoCardCliente({ e }: { e: Edicao & { _s: Record<number, { status: string; em?: string }> } }) {
  return (
    <article className="card" aria-label={e.nome}>
      <h3 className="text-lg [overflow-wrap:anywhere]">{e.nome}</h3>
      {(e.fase || e.dia || e.aplicacao) && <p className="mt-1 flex flex-wrap gap-1.5">{[e.fase, e.dia, e.aplicacao].filter(Boolean).map((v) => <span key={v} className="badge">{v}</span>)}</p>}
      {e.observacao && <p className="hint mt-1">{e.observacao}</p>}
      <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {e.arquivos.map((a, i) => {
          const s = e._s[i] ?? { status: "desconhecido" }; const fora = s.status === "quebrado";
          return (
            <li key={`${a.url}-${i}`} className="sm:min-w-[14rem]">
              <a className={fora || a.tipo === "gabarito" ? "btn btn-ghost w-full" : "btn w-full"} href={fora ? e.fonte : linkDownload(e, i)} rel="noopener nofollow" target="_blank"
                aria-label={`${fora ? "Ver na fonte" : "Baixar"} · ${a.rotulo}, ${e.nome}${fora ? " (link fora do ar)" : " (abre no site oficial)"}`}>
                <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden focusable="false"><path d="M10 3v9m0 0-3.5-3.5M10 12l3.5-3.5M4 16h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span className="min-w-0 [overflow-wrap:anywhere]">{fora ? "Ver na fonte" : "Baixar"} · {a.rotulo}</span>
              </a>
              <p className="hint mt-1 text-xs">{TIPO_ROTULO[a.tipo]} · {a.formato.toUpperCase()}{s.status === "ok" && s.em ? ` · conferido em ${s.em.split("-").reverse().join("/")}` : ""}{fora ? " · link fora do ar" : ""}</p>
            </li>);
        })}
      </ul>
      <p className="hint mt-3 text-xs">Fonte: <a href={e.fonte} target="_blank" rel="noopener nofollow">página oficial</a></p>
    </article>
  );
}
