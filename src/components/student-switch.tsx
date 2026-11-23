import Link from "next/link";
import type { PortalStudent } from "@/lib/portal";
/** Responsável com mais de um filho escolhe de quem está vendo os dados. */
export function StudentSwitch({ list, active, base }: { list: PortalStudent[]; active: string; base: string }) {
  if (list.length < 2) return null;
  return (
    <nav aria-label="Estudante" className="mb-4 flex flex-wrap gap-2">
      {list.map((s) => <Link key={s.id} href={`${base}?aluno=${s.id}`} className="chip no-underline" aria-current={s.id === active ? "true" : undefined}>{s.name.split(" ")[0]}</Link>)}
    </nav>
  );
}
