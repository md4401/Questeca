"use server";
import { redirect } from "next/navigation";
import { requireCtx, setActiveOrg } from "@/lib/session";

export async function switchOrgAction(fd: FormData) {
  const ctx = await requireCtx();
  const id = String(fd.get("orgId") ?? "");
  if (ctx.orgs.some((o) => o.id === id)) await setActiveOrg(ctx.sessionId, id);
  redirect("/app");
}
