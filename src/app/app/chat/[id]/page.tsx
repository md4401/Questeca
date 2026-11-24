import { requireCtx } from "@/lib/session";
import { ChatHome } from "@/components/chat-home";
import { ChatThread } from "@/components/chat-thread";
export const metadata = { title: "Conversa" };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx(); const { id } = await params;
  return <ChatHome ctx={ctx} base="/app/chat" activeId={id}><ChatThread ctx={ctx} id={id} base="/app/chat" /></ChatHome>;
}
