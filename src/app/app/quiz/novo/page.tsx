import { requireCtx } from "@/lib/session";
import { PageHead } from "@/components/page-head";
import { QuizEditor } from "../editor";
export const metadata = { title: "Novo quiz" };
export default async function Novo() { await requireCtx(); return <div className="space-y-4"><PageHead icon="prova" title="Novo quiz" /><QuizEditor id={null} /></div>; }
