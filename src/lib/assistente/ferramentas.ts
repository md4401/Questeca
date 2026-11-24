import "server-only";
import { z } from "zod";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { assessments, assessmentItems, lessonPlans, assistantFiles, students, enrollments } from "@/db/schema";
import type { Ctx } from "@/lib/session";
import { loadClass } from "@/lib/access";
import { myClassesAllOrgs } from "@/lib/my-classes";
import { loadRadar } from "@/lib/radar";
import { loadGradebook, rulesFrom } from "@/lib/gradebook";
import { situation } from "@/lib/core/grades";
import { gradeLabel, subjectLabel, SUBJECTS, GRADES } from "@/lib/taxonomy";
import { selecionarPorTemas, criarProvaPorTemas } from "@/lib/montar";
import { criarPlanoDeAula } from "@/lib/planos";
import { deckSchema, pedidosDeImagem, TEMAS_DECK } from "@/lib/core/deck";
import { baixarImagens } from "./imagens";
import { sql } from "drizzle-orm";

export type Link = { label: string; href: string };
export type Saida = { resultado: unknown; links?: Link[] };
export type Ferramenta = {
  nome: string;
  /** Ferramentas de criação: só rodam depois da entrevista com o professor (ver core/intake). */
  criacao?: boolean;
  descricao: string;
  args: string;
  schema: z.ZodType<Record<string, unknown>>;
  rodar: (ctx: Ctx, a: any) => Promise<Saida>;
};

const SERIES = GRADES.map((g) => g.value);
const DISCIPLINAS = ["todas", ...SUBJECTS.map((s) => s.value)];

/** Ferramentas do assistente. Cada uma só enxerga os dados do professor logado (turmas, provas e planos dele) e só cria rascunhos: nada é apagado nem enviado a ninguém. */
export const FERRAMENTAS: Ferramenta[] = [
  {
    nome: "minhas_turmas", descricao: "Lista as turmas do professor (id, nome, série, disciplina, escola e número de alunos).", args: "{}",
    schema: z.object({}),
    rodar: async (ctx) => {
      const cls = await myClassesAllOrgs(ctx);
      const out = [];
      for (const c of cls) {
        const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(enrollments).where(and(eq(enrollments.classId, c.id), eq(enrollments.status, "active")));
        out.push({ id: c.id, nome: c.name, serie: gradeLabel(c.grade), disciplina: subjectLabel(c.subject), escola: c.orgName, alunos: n?.n ?? 0 });
      }
      return { resultado: out, links: [{ label: "Abrir turmas", href: "/app/turmas" }] };
    },
  },
  {
    nome: "notas_da_turma", descricao: "Médias dos alunos de uma turma em um período (situação: aprovado, recuperação, reprovado, sem notas).", args: '{"classId":"id da turma","periodo":"opcional, ex.: 1º bimestre"}',
    schema: z.object({ classId: z.string().min(10), periodo: z.string().max(40).optional() }),
    rodar: async (ctx, a) => {
      const { cls } = await loadClass(ctx, a.classId);
      const rules = rulesFrom(ctx.org.settings);
      const periodo = a.periodo && rules.periods.includes(a.periodo) ? a.periodo : rules.periods[0];
      const g = await loadGradebook(cls.id, periodo, rules);
      return {
        resultado: { turma: cls.name, periodo, atividades: g.items.map((i) => i.title), alunos: g.rows.map((r) => ({ nome: r.student.name, media: r.computed.average, situacao: situation(r.computed.average, rules.passMark) })) },
        links: [{ label: `Notas de ${cls.name}`, href: `/app/notas?turma=${cls.id}` }],
      };
    },
  },
  {
    nome: "alunos_em_risco", descricao: "Alunos que merecem atenção (queda de nota, faltas), do mais grave ao menos grave, em todas as turmas do professor.", args: "{}",
    schema: z.object({}),
    rodar: async (ctx) => {
      const rows = (await loadRadar(ctx)).slice(0, 15);
      return { resultado: rows.map((r) => ({ aluno: r.studentName, turma: r.className, nivel: r.result.level, motivos: r.result.reasons })) };
    },
  },
  {
    nome: "minhas_provas", descricao: "Últimas provas do professor (id, título, status, número de questões).", args: "{}",
    schema: z.object({}),
    rodar: async (ctx) => {
      const rows = await db.select().from(assessments).where(and(eq(assessments.ownerId, ctx.user.id))).orderBy(desc(assessments.updatedAt)).limit(12);
      const out = [];
      for (const r of rows) {
        const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(assessmentItems).where(eq(assessmentItems.assessmentId, r.id));
        out.push({ id: r.id, titulo: r.title, status: r.status, questoes: n?.n ?? 0 });
      }
      return { resultado: out, links: [{ label: "Abrir provas", href: "/app/provas" }] };
    },
  },
  {
    nome: "meus_planos_de_aula", descricao: "Últimos planos de aula do professor (id, tema, data).", args: "{}",
    schema: z.object({}),
    rodar: async (ctx) => {
      const rows = await db.select().from(lessonPlans).where(eq(lessonPlans.authorId, ctx.user.id)).orderBy(desc(lessonPlans.createdAt)).limit(12);
      return { resultado: rows.map((r) => ({ id: r.id, tema: r.theme, data: r.plannedFor, minutos: r.durationMin })), links: [{ label: "Abrir planos de aula", href: "/app/planos-de-aula" }] };
    },
  },
  {
    nome: "buscar_questoes", descricao: "Pesquisa no banco de questões liberadas por temas, sem criar nada. Use para sugerir ou conferir o que existe antes de gerar a prova.",
    args: `{"temas":["autor, obra ou assunto"],"disciplina":"${DISCIPLINAS.slice(0, 4).join("|")}|... ou todas","serie":"${SERIES.join("|")}","quantidade":10}`,
    schema: z.object({ temas: z.array(z.string().trim().min(2).max(80)).min(1).max(6), disciplina: z.string().default("todas"), serie: z.string().default("9"), quantidade: z.coerce.number().int().min(1).max(20).default(8) }),
    rodar: async (ctx, a) => {
      const r = await selecionarPorTemas({ orgId: ctx.org.id, temas: a.temas, subject: DISCIPLINAS.includes(a.disciplina) ? a.disciplina : "todas", grade: SERIES.includes(a.serie) ? a.serie : "9", count: a.quantidade, insts: [], usedIds: [] });
      return { resultado: r.picked.map((s: any) => ({ titulo: s.q.title, banca: s.q.institution, ano: s.q.year, disciplina: subjectLabel(s.q.subject) })), links: [{ label: "Abrir o banco de questões", href: `/app/banco?q=${encodeURIComponent(a.temas.join(" "))}` }] };
    },
  },
  {
    nome: "gerar_prova", criacao: true, descricao: "Gera uma prova completa (rascunho editável) escolhendo questões liberadas do banco pelos temas, série e disciplina.",
    args: `{"temas":["..."],"disciplina":"lingua-portuguesa|matematica|historia|...|todas","serie":"${SERIES.join("|")}","quantidade":10,"titulo":"opcional","classId":"opcional","criar_com_ia":"banco|completar|novas (padrão banco; só use completar/novas se o professor pedir questões criadas pela GizIA)","confirmado":true}`,
    schema: z.object({ temas: z.array(z.string().trim().min(2).max(80)).min(1).max(6), disciplina: z.string().default("todas"), serie: z.string().default("9"), quantidade: z.coerce.number().int().min(1).max(60).default(10), titulo: z.string().max(140).optional(), classId: z.string().optional(), criar_com_ia: z.enum(["banco", "completar", "novas"]).default("banco"), confirmado: z.boolean().optional() }),
    rodar: async (ctx, a) => {
      const r = await criarProvaPorTemas(ctx, { title: a.titulo, classId: a.classId || null, grade: SERIES.includes(a.serie) ? a.serie : "9", subject: DISCIPLINAS.includes(a.disciplina) ? a.disciplina : "todas", temas: a.temas, count: a.quantidade, ia: a.criar_com_ia });
      if (!r.ok) return { resultado: { erro: r.error } };
      return { resultado: { criada: true, questoes: r.found, pedidas: r.wanted, criadas_pela_ia: r.geradas, aviso: r.aviso }, links: [{ label: "Abrir e editar a prova", href: `/app/provas/${r.id}/editar` }, { label: "Prévia e arquivos", href: `/app/provas/${r.id}/previa` }] };
    },
  },
  {
    nome: "gerar_plano_de_aula", criacao: true, descricao: "Cria um plano de aula completo (objetivos, momentos, avaliação) que o professor pode editar.", args: '{"tema":"...","minutos":50,"classId":"opcional","disciplina":"opcional","serie":"opcional","confirmado":true}',
    schema: z.object({ tema: z.string().trim().min(3).max(300), minutos: z.coerce.number().int().min(20).max(240).default(50), classId: z.string().optional(), disciplina: z.string().max(40).optional(), serie: z.string().max(10).optional(), confirmado: z.boolean().optional() }),
    rodar: async (ctx, a) => {
      const r = await criarPlanoDeAula(ctx, { theme: a.tema, durationMin: a.minutos, classId: a.classId || null, subject: a.disciplina ? subjectLabel(a.disciplina) : undefined, grade: a.serie ? gradeLabel(a.serie) : undefined });
      return { resultado: { criado: true, origem: r.origem ?? "modelo" }, links: [{ label: "Abrir e editar o plano", href: `/app/planos-de-aula/${r.id}` }] };
    },
  },
  {
    nome: "criar_apresentacao", criacao: true,
    descricao: "Cria uma apresentação em PowerPoint (.pptx) com design completo: tema visual que combina com o assunto, 10 modelos de slide, fotos livres com crédito e notas de fala. Siga o guia de design do prompt.",
    args: `{"titulo":"...","subtitulo":"opcional","tema":"${TEMAS_DECK.map((t) => t.id).join("|")}","capaImagem":{"busca":"termos em inglês"},"slides":[{"layout":"topicos|secao|destaque|numero|citacao|comparacao|linha_do_tempo|imagem|atividade|encerramento", ...campos do modelo, "notas":"fala do professor"}],"confirmado":true}`,
    schema: deckSchema.extend({ confirmado: z.boolean().optional() }),
    rodar: async (ctx, a) => {
      const { confirmado: _c, ...entrada } = a; void _c;
      const imagens = await baixarImagens(pedidosDeImagem(entrada));
      const [f] = await db.insert(assistantFiles).values({ orgId: ctx.org.id, ownerId: ctx.user.id, kind: "pptx", title: entrada.titulo, data: { ...entrada, imagens } }).returning();
      return { resultado: { criada: true, slides: entrada.slides.length + 1, tema: entrada.tema, fotos: Object.keys(imagens).length, fotos_pedidas: pedidosDeImagem(entrada).length }, links: [{ label: "Baixar PowerPoint (.pptx)", href: `/api/assistente/arquivo/${f.id}` }] };
    },
  },
];
void students;
