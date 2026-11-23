"use server";
import { redirect } from "next/navigation";
import { requireAnyCtx, setActiveOrg } from "@/lib/session";

export async function switchOrgAction(fd: FormData) {
  const ctx = await requireAnyCtx();
  const id = String(fd.get("orgId") ?? "");
  if (ctx.orgs.some((o) => o.id === id)) await setActiveOrg(ctx.sessionId, id);
  redirect("/app");
}
