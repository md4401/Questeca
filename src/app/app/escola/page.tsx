import { eq, and, count, gte } from "drizzle-orm";
import { requireCtx } from "@/lib/session";
import { db } from "@/db";
import { memberships, users, invitations, classes, classTeachers, assessments, applications, documents } from "@/db/schema";
import { Form, Field, SubmitButton, ConfirmButton } from "@/components/form";
import { createSchoolAction, saveHeaderAction, saveGradingAction, inviteAction, revokeInviteAction, changeRoleAction, removeMemberAction, assignClassAction, leaveOrgAction } from "./actions";
import { rulesFrom } from "@/lib/gradebook";
import { ROLE_LABEL, can } from "@/lib/core/permissions";
import { fmtDate } from "@/lib/format";
import { savePortalSettingsAction } from "./actions";
import { gradeLabel } from "@/lib/taxonomy";
import { planInfo } from "@/lib/billing";
import { PLANS } from "@/lib/core/plans";

export const metadata = { title: "Escola" };

export default async function Escola({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await requireCtx();
  const isSchool = ctx.org.kind === "school";
  const editSettings = !isSchool || can(ctx.org.role, "org.templates");
  const h = ctx.org.settings.header ?? {};
  const rules = rulesFrom(ctx.org.settings);

  const header = editSettings && (
    <section className="card" aria-labelledby="mod">
      <h2 id="mod" className="mb-1 text-lg">Modelo de prova (cabeçalho)</h2>
      <p className="hint mb-3">Cadastrado uma vez, vale para as próximas provas. A prévia em Provas mostra o resultado em A4.</p>
      <Form action={saveHeaderAction}>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Nome da escola" name="schoolName" defaultValue={h.schoolName ?? ctx.org.name} required />
          <Field label="Subtítulo (opcional)" name="subtitle" defaultValue={h.subtitle ?? ""} placeholder="Ensino Fundamental II — Avaliação bimestral" />
          <Field label="Rótulo do professor" name="teacherLabel" defaultValue={h.teacherLabel ?? "Professor(a)"} />
          <Field label="Rodapé (opcional)" name="footer" defaultValue={h.footer ?? ""} />
        </div>
        <div className="field"><label htmlFor="instructions">Instruções ao aluno</label><textarea id="instructions" name="instructions" className="input" defaultValue={h.instructions ?? "Leia com atenção. Use caneta azul ou preta. Não é permitido consultar colegas."} /></div>
        <fieldset className="field"><legend className="label">Campos no cabeçalho</legend><div className="flex flex-wrap gap-4">{["Aluno", "Turma", "Data", "Nota"].map((f) => <label key={f} className="flex gap-2 font-normal"><input type="checkbox" name="fields" value={f} defaultChecked={!h.fields || h.fields.includes(f)} />{f}</label>)}</div></fieldset>
        <div className="field"><label htmlFor="logo">Logo (PNG ou JPG, até 400 KB){h.logoDataUrl ? " — já cadastrado" : ""}</label><input id="logo" name="logo" type="file" accept="image/png,image/jpeg" className="input" />
          {h.logoDataUrl && <label className="flex gap-2 font-normal"><input type="checkbox" name="removeLogo" />Remover logo atual</label>}
          <span className="hint">Use somente logotipos que a instituição autorizou.</span></div>
        <SubmitButton>Salvar modelo</SubmitButton>
      </Form>
    </section>
  );

  const grading = editSettings && (
    <section className="card" aria-labelledby="reg">
      <h2 id="reg" className="mb-1 text-lg">Regras de nota</h2>
      <p className="hint mb-3">O cálculo segue as regras confirmadas e mostra a origem dos valores.</p>
      <Form action={saveGradingAction}>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Escala máxima" name="scaleMax" type="number" step="any" defaultValue={rules.scaleMax} />
          <Field label="Média de aprovação" name="passMark" type="number" step="any" defaultValue={rules.passMark} />
          <div className="field"><label htmlFor="rounding">Arredondamento</label><select id="rounding" name="rounding" defaultValue={rules.rounding} className="input"><option value="none">Sem arredondar</option><option value="tenth">Décimos</option><option value="half">Meio ponto</option><option value="up_half">Meio ponto para cima</option></select></div>
          <div className="field"><label htmlFor="recovery">Recuperação</label><select id="recovery" name="recovery" defaultValue={rules.recovery} className="input"><option value="none">Nenhuma</option><option value="replace_if_higher">Substitui se maior</option><option value="average">Média com a original</option><option value="independent">Atividade independente</option></select></div>
          <div className="field"><label htmlFor="absenceCounts">Ausência na prova</label><select id="absenceCounts" name="absenceCounts" defaultValue={rules.absenceCounts} className="input"><option value="exclude">Não conta na média</option><option value="zero">Conta como zero</option></select></div>
          <div className="field"><label htmlFor="notDeliveredCounts">Falta de entrega</label><select id="notDeliveredCounts" name="notDeliveredCounts" defaultValue={rules.notDeliveredCounts} className="input"><option value="zero">Conta como zero</option><option value="exclude">Não conta na média</option></select></div>
          <div className="md:col-span-2"><Field label="Períodos (separados por vírgula)" name="periods" defaultValue={rules.periods.join(", ")} /></div>
        </div>
        <SubmitButton>Salvar regras</SubmitButton>
      </Form>
    </section>
  );

  const risk = ctx.org.settings.risk;
  const portal = editSettings && (
    <section className="card" aria-labelledby="portal">
      <h2 id="portal" className="mb-1 text-lg">Painel pedagógico</h2>
      <p className="hint mb-3">Limites que acendem os sinais de atenção. São apoio ao professor e à coordenação, nunca diagnóstico.</p>
      <Form action={savePortalSettingsAction}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Frequência mínima (%)" name="minAttendance" type="number" step="any" defaultValue={risk?.minAttendance ?? 75} /><Field label="Média mínima" name="minAverage" type="number" step="any" defaultValue={risk?.minAverage ?? rules.passMark} /></div>
        <SubmitButton>Salvar regras do painel</SubmitButton>
      </Form>
    </section>
  );

  if (!isSchool) {
    return (
      <div className="space-y-6 max-w-4xl">
        <h1>Modelos e regras pessoais</h1>
        <p className="hint">Este é um contexto pessoal ({ctx.org.name}). A associação oficial a uma escola depende de convite ou aprovação da instituição.</p>
        {header}{grading}{portal}
        <section className="card"><h2 className="mb-2 text-lg">Criar ambiente institucional</h2>
          <p className="hint mb-3">Para coordenar professores, convidar equipe e padronizar modelos, crie o ambiente da sua escola (teste de 60 dias).</p>
          <Form action={createSchoolAction}><Field label="Nome da escola" name="name" required /><SubmitButton>Criar ambiente da escola</SubmitButton></Form></section>
      </div>
    );
  }

  const isAdmin = can(ctx.org.role, "org.manage");
  const canSeeMembers = can(ctx.org.role, "member.view");
  const members = canSeeMembers ? await db.select({ m: memberships, u: users }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.status, "active"))) : [];
  const invs = isAdmin ? await db.select().from(invitations).where(eq(invitations.orgId, ctx.org.id)) : [];
  const cls = await db.select().from(classes).where(and(eq(classes.orgId, ctx.org.id), eq(classes.archived, false)));
  const assigns = await db.select().from(classTeachers);
  const info = await planInfo(ctx.org.id);
  const since = new Date(Date.now() - 30 * 864e5);
  const [nAssess] = await db.select({ n: count() }).from(assessments).where(and(eq(assessments.orgId, ctx.org.id), gte(assessments.createdAt, since)));
  const [nApps] = await db.select({ n: count() }).from(applications).where(and(eq(applications.orgId, ctx.org.id), gte(applications.createdAt, since)));
  const pendingDocs = await db.select().from(documents).where(and(eq(documents.orgId, ctx.org.id), eq(documents.status, "in_review")));

  return (
    <div className="space-y-6">
      <h1>{ctx.org.name}</h1>
      <p className="hint">Seu papel: {ROLE_LABEL[ctx.org.role]}. Plano: {PLANS[info.plan].name}{info.sub.limits ? " (teste/contrato)" : ""}, vigente até {fmtDate(info.sub.periodEnd)}.</p>
      {sp.erro && <p className="card-danger" role="alert">{sp.erro}</p>}

      <section className="card" aria-labelledby="acomp"><h2 id="acomp" className="mb-2 text-lg">Acompanhamento (últimos 30 dias)</h2>
        <p className="text-sm">{Number(nAssess.n)} avaliação(ões) criada(s) · {Number(nApps.n)} aplicação(ões) · {members.length} pessoa(s) ativa(s) · {cls.length} turma(s) ativa(s) · {pendingDocs.length} documento(s) aguardando revisão institucional.</p>
        <p className="hint mt-1">Mostramos somente indicadores coletados, com período e escopo. Dados pedagógicos individuais exigem permissão própria.</p></section>

      {header}{grading}{portal}

      {canSeeMembers && (
        <section className="card overflow-x-auto" aria-labelledby="pess"><h2 id="pess" className="mb-3 text-lg">Pessoas e turmas</h2>
          <table className="t"><thead><tr><th>Pessoa</th><th>Papel</th><th>Turmas</th>{isAdmin && <th>Ações</th>}</tr></thead><tbody>
            {members.map(({ m, u }) => {
              const mine = new Set(assigns.filter((a) => a.userId === u.id).map((a) => a.classId));
              return (
                <tr key={m.id}><td>{u.name}<br /><span className="hint">{u.email}</span></td><td>{ROLE_LABEL[m.role as keyof typeof ROLE_LABEL]}</td>
                  <td>{cls.map((c) => (
                    <form key={c.id} action={assignClassAction.bind(null, c.id, u.id, !mine.has(c.id))} className="inline"><button className={`badge mr-1 cursor-pointer ${mine.has(c.id) ? "" : "badge-gray"}`} type="submit" title={mine.has(c.id) ? "Remover da turma" : "Atribuir à turma"}>{c.name}{mine.has(c.id) ? " ✓" : " +"}</button></form>))}
                    {cls.length === 0 && <span className="hint">Sem turmas</span>}</td>
                  {isAdmin && <td className="whitespace-nowrap">{u.id !== ctx.user.id ? (<>
                    {(["teacher", "coordinator", "admin"] as const).filter((r) => r !== m.role).map((r) => <form key={r} action={changeRoleAction.bind(null, m.id, r)} className="inline"><button className="link-btn" type="submit">→ {ROLE_LABEL[r]}</button></form>)}{" "}
                    <form action={removeMemberAction.bind(null, m.id)} className="inline"><ConfirmButton message={`Remover ${u.name} da escola? O acesso é revogado imediatamente.`}>Remover</ConfirmButton></form></>) : <span className="hint">você</span>}</td>}
                </tr>);
            })}
          </tbody></table>
          <p className="hint mt-2">Cada turma só aparece para quem está atribuído a ela (e para a coordenação). A gestão institucional não tem acesso pedagógico por padrão.</p>
        </section>)}

      {isAdmin && (
        <section className="card" aria-labelledby="conv"><h2 id="conv" className="mb-2 text-lg">Convidar</h2>
          <Form action={inviteAction} resetOnOk>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="E-mail" name="email" type="email" required />
              <div className="field"><label htmlFor="role">Papel</label><select id="role" name="role" className="input"><option value="teacher">Professor</option><option value="coordinator">Coordenação</option><option value="admin">Gestão institucional</option></select></div>
            </div>
            {cls.length > 0 && <fieldset className="field"><legend className="label">Turmas atribuídas (opcional)</legend><div className="flex flex-wrap gap-4">{cls.map((c) => <label key={c.id} className="flex gap-2 font-normal"><input type="checkbox" name="classIds" value={c.id} />{c.name} ({gradeLabel(c.grade)})</label>)}</div></fieldset>}
            <SubmitButton>Enviar convite</SubmitButton></Form>
          {invs.length > 0 && <table className="t mt-4"><thead><tr><th>E-mail</th><th>Papel</th><th>Situação</th><th>Validade</th><th></th></tr></thead><tbody>
            {invs.map((i) => { const st = i.status === "pending" && i.expiresAt < new Date() ? "expirado" : i.status === "pending" ? "pendente" : i.status === "accepted" ? "aceito" : "revogado"; return (
              <tr key={i.id}><td>{i.email}</td><td>{ROLE_LABEL[i.role as keyof typeof ROLE_LABEL]}</td><td><span className={`badge ${st === "aceito" ? "" : st === "pendente" ? "badge-amber" : "badge-gray"}`}>{st}</span></td><td>{fmtDate(i.expiresAt)}</td>
                <td>{st === "pendente" && <form action={revokeInviteAction.bind(null, i.id)}><button className="link-btn" type="submit">Revogar</button></form>}{(st === "expirado" || st === "revogado") && <span className="hint">Reenvie criando novo convite</span>}</td></tr>); })}
          </tbody></table>}
        </section>)}

      <section className="card" aria-labelledby="saida"><h2 id="saida" className="mb-2 text-lg">Saída e renovação</h2>
        <p className="text-sm text-ink-soft">Ao sair da escola você perde o acesso aos registros institucionais; sua área pessoal continua independente e o histórico da escola permanece sob as regras do contrato.</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <form action={leaveOrgAction}><ConfirmButton className="btn btn-ghost" message="Sair desta escola?">Sair desta escola</ConfirmButton></form>
          {isAdmin && <a className="btn btn-ghost" href="/api/export/escola">Exportar dados da escola (JSON)</a>}
        </div></section>
    </div>
  );
}
