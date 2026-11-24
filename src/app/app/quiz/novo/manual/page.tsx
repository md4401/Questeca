import Link from "next/link";
import { requireCtx } from "@/lib/session";
import { QuizBuilder } from "../../builder";
export const metadata = { title: "Novo quiz" };
export default async function Manual() {
  await requireCtx();
  return <div className="qb-wrap"><p className="hint mb-2"><Link href="/app/quiz/novo">‹ Voltar</Link></p><QuizBuilder id={null} /></div>;
}
