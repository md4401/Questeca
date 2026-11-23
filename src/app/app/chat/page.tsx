import { requireCtx } from "@/lib/session";
import { ChatHome } from "@/components/chat-home";
export const metadata = { title: "Mensagens" };
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) { return <ChatHome ctx={await requireCtx()} base="/app/chat" q={(await searchParams).q} />; }
