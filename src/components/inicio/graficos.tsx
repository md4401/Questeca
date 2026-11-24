/** Gráficos do Início em SVG puro (sem biblioteca): leves, acessíveis e iguais no servidor e no navegador. */

export function Sparkline({ valores, cor, rotulo }: { valores: number[]; cor: string; rotulo: string }) {
  const W = 100, H = 28, P = 2;
  const max = Math.max(...valores, 1), min = Math.min(...valores, 0);
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(valores.length - 1, 1);
  const y = (v: number) => H - P - ((v - min) / Math.max(max - min, 1)) * (H - 2 * P);
  const pts = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const vazio = valores.every((v) => v === valores[0]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="spark" role="img" aria-label={rotulo} preserveAspectRatio="none">
      {!vazio && <polygon points={`${x(0)},${H} ${pts.join(" ")} ${x(valores.length - 1)},${H}`} fill={cor} opacity=".12" />}
      <polyline points={pts.join(" ")} fill="none" stroke={cor} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={vazio ? 0.45 : 1} />
    </svg>
  );
}

export function Donut({ valor, max = 10, rotulo }: { valor: number | null; max?: number; rotulo: string }) {
  const R = 54, C = 2 * Math.PI * R;
  const frac = valor == null ? 0 : Math.min(Math.max(valor / max, 0), 1);
  return (
    <svg viewBox="0 0 140 140" className="donut" role="img" aria-label={rotulo}>
      <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-line)" strokeWidth="14" />
      {frac > 0 && <circle cx="70" cy="70" r={R} fill="none" stroke="var(--color-brand)" strokeWidth="14" strokeLinecap="round" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 70 70)" />}
      <text x="70" y="68" textAnchor="middle" className="donut-n">{valor == null ? "–" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</text>
      <text x="70" y="88" textAnchor="middle" className="donut-l">média geral</text>
    </svg>
  );
}

/** Linha com área sob a curva: eixo de 0 a 10, um ponto por atividade do período. */
export function AreaChart({ pontos, rotulo }: { pontos: { nome: string; v: number }[]; rotulo: string }) {
  const W = 520, H = 210, L = 30, R = 12, T = 10, B = 28;
  const iw = W - L - R, ih = H - T - B;
  const x = (i: number) => L + (pontos.length === 1 ? iw / 2 : (i * iw) / (pontos.length - 1));
  const y = (v: number) => T + ih - (Math.min(Math.max(v, 0), 10) / 10) * ih;
  const linha = pontos.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="area" role="img" aria-label={rotulo}>
      {[0, 2.5, 5, 7.5, 10].map((g) => (
        <g key={g}><line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="var(--color-line)" strokeDasharray="3 4" /><text x={L - 6} y={y(g) + 4} textAnchor="end" className="axis">{g.toLocaleString("pt-BR")}</text></g>))}
      {pontos.length > 1 && <polygon points={`${x(0)},${y(0)} ${linha} ${x(pontos.length - 1)},${y(0)}`} fill="var(--color-brand)" opacity=".13" />}
      {pontos.length > 1 && <polyline points={linha} fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
      {pontos.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="4" fill="var(--color-sheet)" stroke="var(--color-brand)" strokeWidth="2.5" />)}
      {pontos.map((p, i) => <text key={`t${i}`} x={x(i)} y={H - 8} textAnchor={pontos.length > 1 && i === 0 ? "start" : pontos.length > 1 && i === pontos.length - 1 ? "end" : "middle"} className="axis">{p.nome.length > 11 ? `${p.nome.slice(0, 10)}…` : p.nome}</text>)}
    </svg>
  );
}
