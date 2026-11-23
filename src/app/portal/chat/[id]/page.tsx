import { requirePortal } from "@/lib/portal";
import { ChatThread } from "@/components/chat-thread";
export const metadata = { title: "Conversa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const p = await requirePortal(); return <ChatThread ctx={p.ctx} id={(await params).id} base="/portal/chat" />; }
