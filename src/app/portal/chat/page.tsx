import { requirePortal } from "@/lib/portal";
import { ChatHome } from "@/components/chat-home";
export const metadata = { title: "Mensagens" };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; aluno?: string }> }) { const sp = await searchParams; const p = await requirePortal(sp.aluno); return <ChatHome ctx={p.ctx} base="/portal/chat" q={sp.q} />; }
