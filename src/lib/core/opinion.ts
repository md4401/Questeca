/** Parecer descritivo: registros rápidos (tags) e notas do mês viram um rascunho em linguagem profissional. O professor sempre revisa. */
export const QUICK_TAGS: { id: string; label: string; tone: "pos" | "att"; phrase: string }[] = [
  { id: "participou", label: "Participou bem", tone: "pos", phrase: "participou ativamente das aulas" },
  { id: "colaborou", label: "Ajudou colegas", tone: "pos", phrase: "colaborou com os colegas nas atividades em grupo" },
  { id: "evoluiu", label: "Evoluiu", tone: "pos", phrase: "apresentou evolução na compreensão dos conteúdos" },
  { id: "autonomia", label: "Autonomia", tone: "pos", phrase: "mostrou autonomia na realização das tarefas" },
  { id: "dificuldade", label: "Dificuldade no conteúdo", tone: "att", phrase: "demonstrou dificuldade em acompanhar alguns conteúdos" },
  { id: "disperso", label: "Disperso / conversa", tone: "att", phrase: "teve momentos de dispersão que afetaram a concentração" },
  { id: "tarefa", label: "Tarefa atrasada", tone: "att", phrase: "deixou de entregar algumas atividades no prazo" },
  { id: "material", label: "Sem material", tone: "att", phrase: "esteve sem o material necessário em algumas aulas" },
  { id: "reforco", label: "Precisa de reforço", tone: "att", phrase: "se beneficiaria de atividades de reforço" },
];
const TAG = new Map(QUICK_TAGS.map((t) => [t.id, t]));
export const tagLabel = (id: string) => TAG.get(id)?.label ?? id;
const n1 = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");
const join = (l: string[]) => (l.length <= 1 ? l.join("") : `${l.slice(0, -1).join(", ")} e ${l[l.length - 1]}`);

export type OpinionInput = { name: string; periodLabel: string; tags: string[]; notes: string[]; attendancePct: number | null; average: number | null };

/** Frases por modelo (sem IA). Não inventa fatos: só usa o que foi registrado. Sem registros, devolve null. */
export function templateOpinion(i: OpinionInput): string | null {
  const first = i.name.split(" ")[0];
  const uniq = [...new Set(i.tags)];
  const pos = uniq.map((t) => TAG.get(t)).filter((t): t is NonNullable<typeof t> => !!t && t.tone === "pos").map((t) => t.phrase);
  const att = uniq.map((t) => TAG.get(t)).filter((t): t is NonNullable<typeof t> => !!t && t.tone === "att").map((t) => t.phrase);
  if (!pos.length && !att.length && !i.notes.some((n) => n.trim())) return null; // sem registro do professor, nada a redigir
  const parts: string[] = [];
  if (pos.length) parts.push(`Em ${i.periodLabel}, ${first} ${join(pos)}.`);
  if (att.length) parts.push(`${pos.length ? "Por outro lado, " : `Em ${i.periodLabel}, `}${first} ${join(att)}.`);
  const nums: string[] = [];
  if (i.attendancePct != null) nums.push(`frequência de ${n1(i.attendancePct)}%`);
  if (i.average != null) nums.push(`média ${n1(i.average)}`);
  if (nums.length) parts.push(`No período, registrou ${join(nums)}.`);
  const extra = i.notes.map((n) => n.trim()).filter(Boolean);
  if (extra.length) parts.push(`Registros do professor: ${extra.map((n) => n.replace(/[.\s]+$/, "")).join("; ")}.`);
  parts.push(att.length ? `Recomenda-se acompanhamento próximo e diálogo com a família para apoiar o desenvolvimento de ${first}.` : `Sugere-se manter o incentivo para que ${first} continue avançando.`);
  return parts.join(" ");
}
