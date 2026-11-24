"use client";
import { useState } from "react";
import { corrigirFotoAction, type ResultadoCorrecao } from "./actions";

export function CorrigirFoto() {
  const [r, setR] = useState<ResultadoCorrecao | null>(null); const [env, setEnv] = useState(false); const [nota, setNota] = useState(""); const [com, setCom] = useState("");
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setEnv(true); setR(null);
    const res = await corrigirFotoAction(null, new FormData(e.currentTarget));
    setR(res); setNota(res.nota != null ? String(res.nota).replace(".", ",") : ""); setCom(res.comentario ?? ""); setEnv(false);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card"><form onSubmit={enviar}>
        <div className="field"><label htmlFor="enunciado">Enunciado da questão</label><textarea id="enunciado" name="enunciado" className="input" required /></div>
        <div className="field"><label htmlFor="criterio">Critério / resposta esperada</label><textarea id="criterio" name="criterio" className="input" required placeholder="Ex.: Cita a causa econômica (1 pt), a política (1 pt) e relaciona às consequências (1 pt)." /></div>
        <div className="field"><label htmlFor="pontos">Valor da questão (pontos)</label><input id="pontos" name="pontos" className="input w-28" defaultValue="3" inputMode="decimal" /></div>
        <div className="field"><label htmlFor="foto">Foto da resposta do aluno</label><input id="foto" name="foto" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" className="input" required /></div>
        <button className="btn" type="submit" disabled={env} aria-busy={env}>{env ? "Lendo a resposta…" : "Corrigir"}</button>
        {r?.error && <p className="err mt-3 text-sm" role="alert">{r.error}</p>}
      </form></section>
      <section className="card" aria-live="polite"><h2 className="mb-2 text-lg">Sugestão</h2>
        {!r?.ok ? <p className="text-sm text-ink-soft">O resultado aparece aqui. Nada é salvo: copie a nota e o comentário para onde quiser.</p> : (
          <div className="space-y-3">
            {!r.legivel && <p className="card-amber text-sm">A letra ficou difícil de ler. Confira a foto ou corrija manualmente.</p>}
            <div><p className="text-sm font-semibold">O que a GizIA leu</p><p className="whitespace-pre-line rounded-lg bg-brand-tint p-2 text-sm" data-testid="transcricao">{r.transcricao || "—"}</p></div>
            <div className="field"><label htmlFor="nota">Nota sugerida (de {String(r.pontos).replace(".", ",")})</label><input id="nota" className="input w-28" value={nota} onChange={(e) => setNota(e.target.value)} data-testid="nota-sugerida" /></div>
            <div className="field"><label htmlFor="com">Comentário ao aluno</label><textarea id="com" className="input" value={com} onChange={(e) => setCom(e.target.value)} /></div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => navigator.clipboard?.writeText(`Nota: ${nota}\n${com}`)}>Copiar nota e comentário</button>
            <p className="hint">Sugestão automática: revise antes de usar.</p>
          </div>)}
      </section>
    </div>
  );
}
