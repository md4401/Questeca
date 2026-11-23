import { requireCtx } from "@/lib/session";
import { ChatThread } from "@/components/chat-thread";
export const metadata = { title: "Conversa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <ChatThread ctx={await requireCtx()} id={(await params).id} base="/app/chat" />; }
