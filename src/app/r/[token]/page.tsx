import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { digitalLinks, applications, assessmentVersions, students } from "@/db/schema";
import { Form, SubmitButton } from "@/components/form";
import { submitDigitalAction } from "./actions";
import type { Snapshot } from "@/lib/assessments";
import { Logo } from "@/components/logo";

export const metadata: Metadata = { title: "Responder prova", robots: { index: false, follow: false } };

export default async function Responder({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [link] = /^[A-Za-z0-9_-]{16,64}$/.test(token) ? await db.select().from(digitalLinks).where(eq(digitalLinks.token, token)).limit(1) : [];
  const box = (title: string, msg: string) => (
    <main id="conteudo" className="mx-auto max-w-md px-4 py-16 text-center"><Logo /><h1 className="mt-6">{title}</h1><p className="mt-2 text-ink-soft">{msg}</p></main>);
  if (!link) return box("Link inválido", "Confira o endereço recebido do seu professor.");
  if (link.submittedAt) return box("Respostas já enviadas", "Este link só pode ser usado uma vez.");
  if (link.expiresAt < new Date()) return box("Prazo encerrado", "O prazo deste link terminou. Fale com seu professor.");
  const [app] = await db.select().from(applications).where(eq(applications.id, link.applicationId)).limit(1);
  const [ver] = app?.versionId ? await db.select().from(assessmentVersions).where(eq(assessmentVersions.id, app.versionId)).limit(1) : [];
  const [stu] = await db.select({ name: students.name }).from(students).where(eq(students.id, link.studentId)).limit(1);
  if (!app || !ver) return box("Avaliação indisponível", "Fale com seu professor.");
  if (!link.openedAt) await db.update(digitalLinks).set({ openedAt: new Date() }).where(eq(digitalLinks.id, link.id));
  const snap = ver.snapshot as Snapshot;
  const firstName = (stu?.name ?? "").split(" ")[0];
  return (
    <main id="conteudo" className="mx-auto max-w-3xl px-4 py-8">
      <Logo />
      <h1 className="mt-4">{snap.title}</h1>
      <p className="hint">{(snap.header as { schoolName?: string })?.schoolName ?? ""} · Aluno(a): {firstName}. Você pode enviar uma única vez, até {link.expiresAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>
      <Form action={submitDigitalAction.bind(null, token)} className="mt-6 space-y-5">
        {snap.items.map((it) => (
          <fieldset key={it.position} className="card">
            <legend className="px-1 font-bold">Questão {it.position}</legend>
            <p className="statement whitespace-pre-line">{it.statement}</p>
            <div className="mt-2 space-y-1">{it.alternatives.map((a) => (
              <label key={a.key} className="flex items-start gap-2 font-normal"><input type="radio" name={`q${it.position}`} value={a.key} className="mt-1.5" /><span className="statement text-base"><strong>{a.key})</strong> {a.text}</span></label>))}</div>
          </fieldset>))}
        <p className="hint">Questões sem resposta serão registradas em branco. Depois de enviar não é possível alterar.</p>
        <SubmitButton pendingLabel="Enviando…">Enviar respostas</SubmitButton>
      </Form>
    </main>
  );
}
