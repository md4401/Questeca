"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, userAvatars } from "@/db/schema";
import { requireAnyCtx } from "@/lib/session";
import type { FormState } from "@/components/form";

export async function saveThemeAction(theme: string) {
  const ctx = await requireAnyCtx();
  if (!["light", "dark", "system"].includes(theme)) return;
  await db.update(users).set({ prefs: { ...(ctx.user.prefs ?? {}), theme: theme as "light" | "dark" | "system" } }).where(eq(users.id, ctx.user.id));
}

const MAX_AVATAR = 200 * 1024;
function sniff(b: Buffer): string | null {
  if (b.length > 12 && b[0] === 0x89 && b.subarray(1, 4).toString() === "PNG") return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

/** Foto de perfil opcional (PNG, JPG ou WebP até 200 KB). O tipo vem do conteúdo, não do nome do arquivo. */
export async function saveAvatarAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const f = fd.get("avatar");
  if (fd.get("remove") === "1") { await db.delete(userAvatars).where(eq(userAvatars.userId, ctx.user.id)); revalidatePath("/", "layout"); return { ok: "Foto removida." }; }
  if (!(f instanceof File) || f.size === 0) return { error: "Escolha uma imagem." };
  if (f.size > MAX_AVATAR) return { error: "A imagem passa de 200 KB. Use uma foto menor." };
  const buf = Buffer.from(await f.arrayBuffer());
  const type = sniff(buf);
  if (!type) return { error: "Use PNG, JPG ou WebP." };
  await db.insert(userAvatars).values({ userId: ctx.user.id, type, data: buf }).onConflictDoUpdate({ target: userAvatars.userId, set: { type, data: buf, updatedAt: new Date() } });
  revalidatePath("/", "layout");
  return { ok: "Foto atualizada." };
}

export async function savePortalProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const ctx = await requireAnyCtx();
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 120) return { error: "Informe seu nome." };
  await db.update(users).set({ name, prefs: { ...(ctx.user.prefs ?? {}), largeFont: fd.get("largeFont") === "on" } }).where(eq(users.id, ctx.user.id));
  revalidatePath("/portal", "layout");
  return { ok: "Perfil salvo." };
}
