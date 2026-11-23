import "server-only";
import { db } from "@/db";
import { events } from "@/db/schema";

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email:sem-provedor] para=${opts.to} assunto="${opts.subject}"`);
    if (process.env.DEV_EMAIL_OUTBOX === "1") {
      await db.insert(events).values({ name: "dev_email", meta: { to: opts.to, subject: opts.subject, text: opts.text ?? opts.html } });
    }
    return { sent: false as const };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Questeca <onboarding@resend.dev>", to: opts.to, subject: opts.subject, html: opts.html, text: opts.text }),
  });
  if (!res.ok) { console.error("Resend falhou", res.status, await res.text()); return { sent: false as const }; }
  return { sent: true as const };
}

export const emailEnabled = () => !!process.env.RESEND_API_KEY;

export function layoutMail(title: string, bodyHtml: string, cta?: { href: string; label: string }) {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;color:#1B302C">
  <h2 style="font-family:Georgia,serif;color:#135B4E">Questeca</h2><h3>${title}</h3>${bodyHtml}
  ${cta ? `<p><a href="${cta.href}" style="background:#135B4E;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">${cta.label}</a></p><p style="font-size:12px;color:#666">Se o botão não funcionar, copie: ${cta.href}</p>` : ""}
  </div>`;
}
